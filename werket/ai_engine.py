"""Hybrid AI content generation engine for Werket.

Tries LLM first (Ollama/OpenAI), falls back to offline NLP generation.
Supports both Amharic and English.
"""
import re
import json
import os
import hashlib
import random
import threading
import urllib.request
import urllib.error
from html import escape as html_escape
from pathlib import Path
from django.conf import settings


# ---------------------------------------------------------------------------
# LLM client (adapted from amharic-nlp-chatbot/llm.py)
# ---------------------------------------------------------------------------

_LLM_TIMEOUT = float(os.environ.get('LLM_TIMEOUT', '60'))
_LLM_MAX_TOKENS = int(os.environ.get('LLM_MAX_TOKENS', '1500'))
_llm_cache = {}
_llm_cache_lock = threading.Lock()
_detect_lock = threading.RLock()
_detected = None


def _post_json(url, payload, timeout, api_key=None):
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Werket-AI/1.0',
    }
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', 'replace')


def _get_json(url, timeout):
    req = urllib.request.Request(url, headers={'User-Agent': 'Werket-AI/1.0'}, method='GET')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', 'replace')


def _configured_backend():
    base = os.environ.get('LLM_BASE_URL') or os.environ.get('OPENAI_BASE_URL')
    key = os.environ.get('LLM_API_KEY') or os.environ.get('OPENAI_API_KEY', '')
    model = os.environ.get('LLM_MODEL')
    if base:
        return (base.rstrip('/') + '/chat/completions', key, model)
    if key:
        return ('https://api.openai.com/v1/chat/completions', key, model or 'gpt-4o-mini')
    return None


def _ollama_endpoint():
    global _detected
    with _detect_lock:
        if _detected is not None:
            return _detected
        try:
            raw = _get_json('http://localhost:11434/api/tags', 2.0)
            models = [m['name'] for m in json.loads(raw).get('models', [])]
            if models:
                _detected = ('http://localhost:11434/v1/chat/completions', '', None, models)
                return _detected
        except Exception:
            pass
        _detected = False
        return False


def _pick_model(model, available_models):
    if model:
        return model
    if not available_models:
        return None
    for pref in ('qwen', 'llama', 'gemma', 'mistral', 'aya', 'phi'):
        for m in available_models:
            if pref in m.lower():
                return m
    return available_models[0]


def _llm_available():
    if _configured_backend():
        return True
    return bool(_ollama_endpoint())


def _llm_chat(system, user, max_tokens=_LLM_MAX_TOKENS, timeout=_LLM_TIMEOUT):
    backend = _configured_backend()
    avail_models = None
    if not backend:
        ollama = _ollama_endpoint()
        if not ollama:
            return None
        backend = ollama[0], '', None
        avail_models = ollama[3]
    url, key, cfg_model = backend

    messages = [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
    ]

    payload = {
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.85,
    }
    chosen = _pick_model(cfg_model, avail_models)
    if chosen:
        payload['model'] = chosen

    cache_key = hashlib.sha1(json.dumps(payload, ensure_ascii=False).encode('utf-8')).hexdigest()
    with _llm_cache_lock:
        if cache_key in _llm_cache:
            return _llm_cache[cache_key]

    try:
        raw = _post_json(url, payload, timeout, api_key=key or None)
        data = json.loads(raw)
        reply = data['choices'][0]['message']['content'].strip()
    except Exception:
        return None
    if not reply:
        return None

    with _llm_cache_lock:
        if len(_llm_cache) < 100:
            _llm_cache[cache_key] = reply
    return reply


# ---------------------------------------------------------------------------
# NLP helpers (from werk/api.py)
# ---------------------------------------------------------------------------

TOKEN_RE = re.compile(r'[\u1200-\u135a]+')

_fold_map = str.maketrans(
    'ሐሑሒሓሔሕሖኀኁኂኃኄኅኆሠሡሢሣሤሥሦኣፀፁፂፃፄፅፆ',
    'ሀሁሂሃሄህሆሀሁሂሃሄህሆሰሱሲሳሴስሶአጸጹጺጻጼጽጾ'
)


def fold(text):
    return (text or '').translate(_fold_map)


def _load_model():
    try:
        data_dir = getattr(settings, 'DATA_DIR', Path(__file__).resolve().parent.parent / 'data')
        with open(data_dir / 'nl_model.json', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _load_words():
    try:
        data_dir = getattr(settings, 'DATA_DIR', Path(__file__).resolve().parent.parent / 'data')
        with open(data_dir / 'amharic_words.json', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('words', [])
    except (OSError, ValueError):
        return []


MODEL = _load_model()
WORDS = _load_words()


def _next_words(prev, second=''):
    counts = {}
    if second and (key := second + '|' + prev) in MODEL.get('trigram', {}):
        for word, count in MODEL['trigram'][key].items():
            counts[word] = counts.get(word, 0) + count * 3
    for word, count in MODEL.get('bigram', {}).get(prev, {}).items():
        counts[word] = counts.get(word, 0) + count
    return [w for w, _ in sorted(counts.items(), key=lambda p: (-p[1], p[0]))[:8]]


def _topic_words(topic, n=8):
    """Find dictionary words related to the topic via prefix matching."""
    ft = fold(topic)
    matches = []
    for item in WORDS:
        w = item.get('w', '')
        if fold(w).startswith(ft[:3]) and len(w) > 2:
            matches.append(w)
        if len(matches) >= n:
            break
    return matches


def _sentences_from_model(topic, count=5):
    """Generate Amharic sentences using the n-gram model seeded by topic words."""
    starters = MODEL.get('starters', {})
    topic_w = TOKEN_RE.findall(topic)

    seed = topic_w[0] if topic_w else (list(starters.keys())[0] if starters else None)
    if not seed:
        return []

    sentences = []
    for _ in range(count * 3):
        words = [seed]
        for _ in range(15):
            prev = words[-1] if words else ''
            second = words[-2] if len(words) > 1 else ''
            nxt = _next_words(prev, second)
            if not nxt:
                break
            words.append(random.choice(nxt))
        if len(words) >= 4:
            sentences.append(' '.join(words))
        if len(sentences) >= count:
            break
    return sentences


# ---------------------------------------------------------------------------
# Offline NLP content generators
# ---------------------------------------------------------------------------

def _generate_amharic_offline(topic, content_type):
    """Generate Amharic content using the n-gram model when no LLM is available."""
    topic_words = _topic_words(topic)
    model_sentences = _sentences_from_model(topic, 6)

    t = html_escape(topic.strip())

    if content_type == 'story':
        body = _generate_amharic_story(t, topic_words, model_sentences)
    elif content_type == 'essay':
        body = _generate_amharic_essay(t, topic_words, model_sentences)
    elif content_type == 'outline':
        body = _generate_amharic_outline(t, topic_words, model_sentences)
    else:
        body = _generate_amharic_summary(t, topic_words, model_sentences)

    return body


def _generate_amharic_summary(topic, related_words, model_sentences):
    rw = ', '.join(related_words[:5]) if related_words else 'ተጨማሪ መረጃ'
    sentences = ' '.join(model_sentences[:3]) if model_sentences else ''

    return (
        f'<h1>{topic}</h1>\n'
        f'<h2>መግቢያ</h2>\n'
        f'<p>{topic} በዚህ ዘመን በጣም አስፈላጊ ርዕስ ነው። በዚህ ሰነድ {topic} ዋጋውን፣ '
        f'ተግባራዊ መረጃዎቹንና የሚያሰኙ ነገሮች እንመለከታለን።</p>\n'
        f'<h2>ዋና ይዘት</h2>\n'
        f'<p>ስለ {topic} ብዙ ምክንያቶች አሉ። {rw} ከነዚህ ውስጥ ያሉ ምክንያቶች ናቸው። '
        f'በመሆኑም ሁሉም ሰው ስለዚህ ርዕስ ትኩረት ይሰጥ አለበት።</p>\n'
        f'<p>{sentences}</p>\n'
        f'<h2>ተግባራዊ ማብራሪያ</h2>\n'
        f'<p>{topic} በትግበራ በኩል ብዙ መብራቶች አሉት። እያንዳንዱ ሰው የራሱ ተግባር '
        f'በመያዝ {topic}ን ማሻሻል ይችላል።</p>\n'
        f'<h2>ማጠቃለያ</h2>\n'
        f'<p>በአጠቃላይ {topic} ችላ ሊባል የማይችል ርዕስ ነው። ሁሉም በትኩረት '
        f'ለማድረግ ይገባል። ስለዚህ ርዕስ ተጨማሪ ምርምር አስፈላጊ ነው።</p>\n'
    )


def _generate_amharic_story(topic, related_words, model_sentences):
    rw = related_words[0] if related_words else 'ማይክል'
    return (
        f'<h1>ታሪክ · {topic}</h1>\n'
        f'<p>በ{topic} ዘመን ማንኛውም ሰው ምስጢር የተደበቀ ታሪክ ይዞ ይኖር ነበር።</p>\n'
        f'<h2>መጀመሪያ</h2>\n'
        f'<p>አንድ ቀን {rw} የተባለ ወጣት ከመንገድ ላይ ያልተለመደ ነገር አገኘ። '
        f'የ {topic} ምስጢር በውስጡ ይደበቅ ነበር።</p>\n'
        f'<h2>ግንባር</h2>\n'
        f'<p>{" ".join(model_sentences[:2]) if model_sentences else topic + " በተለየ መንገድ"}'
        f' "{rw}" ከዚያ ቀጥሎ ታሪኩ ይቀጥላል።</p>\n'
        f'<h2>መጨረሻ</h2>\n'
        f'<p>በመጨረሻም {topic} ታሪኩ ሰዎችን በጣም አስደናቂ አደረገ። '
        f'ከዚያ በኋላ ሁሉም ሰው ስለ {topic} ታሪክ ማወቅ ጀመረ።</p>\n'
    )


def _generate_amharic_essay(topic, related_words, model_sentences):
    rw = ', '.join(related_words[:4]) if related_words else ''
    return (
        f'<h1>ድርሰት · {topic}</h1>\n'
        f'<h2>መግቢያ</h2>\n'
        f'<p>እያንዳንዱ {topic} በአሁኑ ዘመን በጣም አስፈላጊ ርዕስ ነው። '
        f'በዚህ ድርሰት {topic} ዋጋውን፣ ፈተናዎቹንና መፍትሄውን እንመለከታለን።</p>\n'
        f'<h2>አንቀጽ 1 — ዋጋ/ጠቀሜታ</h2>\n'
        f'<p>ለምን «{topic}» አስፈላጊ ነው? {rw} ከነዚህ ውስጥ ያሉ ምክንያቶች ናቸው። '
        f'3 ቁጥር ምክንያቶችን ከዚህ በታች ዘርዝረናል።</p>\n'
        f'<h2>አንቀጽ 2 — ፈተና</h2>\n'
        f'<p>በ«{topic}» ዙሪያ የሚታዩ ችግሮችን እንመለከታለን። '
        f'{" ".join(model_sentences[:2]) if model_sentences else "ተጨማሪ መረጃ ያስፈልጋል።"}</p>\n'
        f'<h2>አንቀጽ 3 — መፍትሄ</h2>\n'
        f'<p>እነዚህን ፈተናዎች ለማሸነፍ የሚቻሉ ተግባራዊ እርምጃዎች አሉ።</p>\n'
        f'<h2>ማጠቃለያ</h2>\n'
        f'<p>በማጠቃለል፣ {topic} ችላ ሊባል የማይችል በመሆኑ፣ '
        f'ሁሉም በትኩረት ሊሰራበት ይገባል።</p>\n'
    )


def _generate_amharic_outline(topic, related_words, model_sentences):
    return (
        f'<h1>ዝርዝር · {topic}</h1>\n'
        f'<h2> #=> ዋና ርዕሮች</h2>\n'
        f'<ul>\n'
        f'<li>መግቢያ — {topic} አጭር መግለጫ</li>\n'
        f'<li>ጠቀሜታ — {topic} ዋጋ እና ጠቀሜታ</li>\n'
        f'<li>ፈተና — {topic} ችግሮች</li>\n'
        f'<li>መፍትሄ — {topic} ተግባራዊ እርምጃዎች</li>\n'
        f'<li>ማጠቃለያ — {topic} ማጠቃለያ</li>\n'
        f'</ul>\n'
        f'<h2> #=> ምክር ቤት</h2>\n'
        f'<p>ስለ {topic} ተጨማሪ ምርምር ያድርጉ።</p>\n'
    )


def _generate_english_offline(topic, content_type):
    """Generate English content when no LLM is available."""
    t = html_escape(topic.strip())

    if content_type == 'story':
        return (
            f'<h1>{t}</h1>\n'
            f'<h2>The Beginning</h2>\n'
            f'<p>It was a dark and stormy night when the story of {t} began. '
            f'Nobody could have predicted what was about to unfold.</p>\n'
            f'<h2>The Journey</h2>\n'
            f'<p>As the days passed, {t} revealed itself in ways no one expected. '
            f'The characters found themselves drawn deeper into the mystery.</p>\n'
            f'<h2>The Discovery</h2>\n'
            f'<p>In the end, the truth about {t} was more extraordinary than '
            f'anyone had imagined. And nothing would ever be the same.</p>\n'
        )
    elif content_type == 'essay':
        return (
            f'<h1>{t}</h1>\n'
            f'<h2>Introduction</h2>\n'
            f'<p>{t} is a topic of growing importance in today\'s world. '
            f'In this essay, we explore its significance, challenges, and potential solutions.</p>\n'
            f'<h2>Significance</h2>\n'
            f'<p>Understanding {t} is crucial because it affects many aspects of '
            f'our daily lives. Here are three key reasons why it matters.</p>\n'
            f'<h2>Challenges</h2>\n'
            f'<p>Despite its importance, {t} faces several challenges that need '
            f'to be addressed for meaningful progress.</p>\n'
            f'<h2>Conclusion</h2>\n'
            f'<p>In conclusion, {t} deserves our attention and action. '
            f'By working together, we can make a difference.</p>\n'
        )
    elif content_type == 'outline':
        return (
            f'<h1>Outline: {t}</h1>\n'
            f'<ul>\n'
            f'<li>Introduction — overview of {t}</li>\n'
            f'<li>Background — history and context</li>\n'
            f'<li>Key Points — main arguments about {t}</li>\n'
            f'<li>Analysis — examining the evidence</li>\n'
            f'<li>Conclusion — summary and next steps</li>\n'
            f'</ul>\n'
        )
    else:  # summary
        return (
            f'<h1>{t}</h1>\n'
            f'<h2>Overview</h2>\n'
            f'<p>{t} is a fascinating and important topic. This summary provides '
            f'a one-page overview of the key aspects, significance, and implications.</p>\n'
            f'<h2>Key Points</h2>\n'
            f'<p>The most important aspects of {t} include its historical context, '
            f'current developments, and future outlook. Each of these areas offers '
            f'valuable insights for understanding the bigger picture.</p>\n'
            f'<h2>Significance</h2>\n'
            f'<p>Why does {t} matter? Because it touches many areas of our lives, '
            f'from culture and history to technology and society. Understanding it '
            f'helps us make better decisions.</p>\n'
            f'<h2>Conclusion</h2>\n'
            f'<p>In summary, {t} is worth exploring in depth. '
            f'This one-page overview is just the beginning of a much larger conversation.</p>\n'
        )


# ---------------------------------------------------------------------------
# LLM content generators
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_EN = (
    "You are a writing assistant for the Werket editor. "
    "Generate well-structured, informative content as clean HTML. "
    "Use <h1> for the title, <h2> for sections, <p> for paragraphs, "
    "<ul>/<li> for lists. Do not include <html>, <body>, or <head> tags. "
    "Write 300-600 words. Be informative and engaging."
)

_SYSTEM_PROMPT_AM = (
    "አንተ ለ Werket editor የጽህፈት ረዳት ነዎ። "
    "ጽሁፍህን በንድ UI ቅርጽ HTML ስጥ። "
    "<h1> ለርዕስ፣ <h2> ለአንቀጽ፣ <p> ለአንቀጽ፣ "
    "<ul>/<li> ለዝርዝር ተጠቀም። <html>፣ <body>፣ <head> አትጠቀም። "
    "300-600 ቃላት ጻፍ። ለመያዝና መረጃ የበለጠ ይሁን።"
)


def _llm_generate(topic, lang, content_type):
    """Generate content using an LLM backend."""
    type_labels = {
        'summary': {'en': 'informative summary', 'am': 'አጭር ማጠቃለያ'},
        'story': {'en': 'short story', 'am': 'አጭር ታሪክ'},
        'essay': {'en': 'essay', 'am': 'ድርሰት'},
        'outline': {'en': 'detailed outline', 'am': 'ዝርዝር ማዕረግ'},
    }
    type_label = type_labels.get(content_type, type_labels['summary']).get(lang, 'summary')
    system = _SYSTEM_PROMPT_AM if lang == 'am' else _SYSTEM_PROMPT_EN
    user_msg = f"Write a one-page {type_label} about: {topic}"
    if lang == 'am':
        user_msg = f"ስለ «{topic}» አንድ ገጽ የሚሆን {type_label} ጻፍ።"

    return _llm_chat(system, user_msg, max_tokens=1200)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate(topic, lang='am', content_type='summary'):
    """
    Generate content for the given topic.

    Args:
        topic: The topic to write about
        lang: 'am' for Amharic, 'en' for English
        content_type: 'summary', 'story', 'essay', or 'outline'

    Returns:
        HTML string with the generated content
    """
    topic = (topic or '').strip()
    if not topic:
        topic = 'የኢትዮጵያ ታሪክ' if lang == 'am' else 'Ethiopian History'

    # Try LLM first
    if _llm_available():
        try:
            result = _llm_generate(topic, lang, content_type)
            if result and len(result) > 100:
                return result
        except Exception:
            pass

    # Fall back to offline NLP
    if lang == 'am':
        return _generate_amharic_offline(topic, content_type)
    else:
        return _generate_english_offline(topic, content_type)
