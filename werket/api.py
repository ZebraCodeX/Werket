"""Dictionary-backed Amharic hints, spell detection, and correction ranking.

Refactored from nlp.py for Django integration.
"""
import json
import os
import re
from pathlib import Path
from django.conf import settings

TOKEN = re.compile(r'[\u1200-\u135a]+')
PUNCT = re.compile(r'^(.*?)([።፣፤፥፦፧፨,.!?;:]*)$')

_fold_map = str.maketrans(
    'ሐሑሒሓሔሕሖኀኁኂኃኄኅኆሠሡሢሣሤሥሦኣፀፁፂፃፄፅፆ',
    'ሀሁሂሃሄህሆሀሁሂሃሄህሆሰሱሲሳሴስሶአጸጹጺጻጼጽጾ'
)


def fold(text):
    return (text or '').translate(_fold_map)


def _load_json(name, default):
    try:
        data_dir = getattr(settings, 'DATA_DIR', Path(__file__).resolve().parent.parent / 'data')
        with open(data_dir / name, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


_raw_words = _load_json('amharic_words.json', {}).get('words', [])
WORDS = [x for x in _raw_words if isinstance(x, dict) and x.get('w')]
_by_fold = {}
for item in WORDS:
    _by_fold.setdefault(fold(item['w']), item)
KNOWN = set(_by_fold)
MODEL = _load_json('nl_model.json', {})


def _distance(a, b, limit=3):
    """Bounded Levenshtein distance, used only for short correction candidates."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        row_min = i
        for j, cb in enumerate(b, 1):
            value = min(current[-1] + 1, previous[j] + 1,
                        previous[j - 1] + (ca != cb))
            current.append(value)
            row_min = min(row_min, value)
        if row_min > limit:
            return limit + 1
        previous = current
    return previous[-1]


def _partial(text):
    if not text or text[-1].isspace() or text[-1] in '።፣፤፥፦፧፨,.!?;:':
        return ''
    words = TOKEN.findall(text)
    return words[-1] if words else ''


def _next_words(last, second=''):
    counts = {}
    if second and (key := second + '|' + last) in MODEL.get('trigram', {}):
        for word, count in MODEL['trigram'][key].items():
            counts[word] = counts.get(word, 0) + count * 3
    for word, count in MODEL.get('bigram', {}).get(last, {}).items():
        counts[word] = counts.get(word, 0) + count
    return [word for word, _ in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[:6]]


_CORR_CACHE = {}


def _corrections(word, limit=5):
    target = fold(word)
    cached = _CORR_CACHE.get(target)
    if cached is not None:
        return cached[:limit]
    candidates = []
    for item in WORDS:
        candidate = item['w']
        folded = fold(candidate)
        distance = _distance(target, folded, 2)
        if distance <= 2:
            candidates.append((distance, -int(item.get('n', 1)), candidate))
    candidates.sort()
    result = [{'word': word, 'distance': distance, 'frequency': -freq}
              for distance, freq, word in candidates[:limit]]
    if len(_CORR_CACHE) >= 2000:
        _CORR_CACHE.pop(next(iter(_CORR_CACHE)))
    _CORR_CACHE[target] = result
    return result


def check(text):
    """Check spelling of text, return list of word results."""
    results = []
    for match in TOKEN.finditer(text or ''):
        word = match.group(0)
        known = fold(word) in KNOWN
        results.append({
            'word': word,
            'start': match.start(),
            'end': match.end(),
            'known': known,
            'suggestions': [] if known else _corrections(word)
        })
    return results


def suggest(text):
    """Get word suggestions for text."""
    text = text or ''
    tokens = TOKEN.findall(text)
    partial = _partial(text)
    words = []
    if partial:
        prefix = fold(partial)
        words = [item['w'] for item in WORDS if fold(item['w']).startswith(prefix) and item['w'] != partial][:8]
        if not words and fold(partial) not in KNOWN:
            words = [item['word'] for item in _corrections(partial, 8)]
    last = tokens[-1] if tokens else ''
    second = tokens[-2] if len(tokens) > 1 else ''
    next_words = _next_words(last, second) if not partial else []
    return {'words': words, 'next': next_words, 'dictionary_size': len(WORDS)}