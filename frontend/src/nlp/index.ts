/**
 * Offline Amharic dictionary + predictions.
 *
 * A TypeScript port of `werket/api/__init__.py` so spell-check and
 * predictions work without the server. The word list is loaded eagerly on
 * first use; the (large) n-gram model is loaded lazily the first time
 * next-word predictions are requested.
 */
export interface SuggestionItem {
  word: string;
  distance: number;
  frequency: number;
}

export interface CheckWord {
  word: string;
  start: number;
  end: number;
  known: boolean;
  suggestions: SuggestionItem[];
}

export interface SuggestResponse {
  words: string[];
  next: string[];
  dictionary_size: number;
}

const TOKEN = /[\u1200-\u135a]+/g;
const ADJACENT_TOKEN = /[\u1200-\u135a]+$/;
const WORD_BOUNDARY = /[\s\u1361\u1362\u1363\u1364\u1365\u1366\u1367\u1368.!?;:,]/;

const FOLD_SRC = 'ሐሑሒሓሔሕሖኀኁኂኃኄኅኆሠሡሢሣሤሥሦኣፀፁፂፃፄፅፆ';
const FOLD_DST = 'ሀሁሂሃሄህሆሀሁሂሃሄህሆሰሱሲሳሴስሶአጸጹጺጻጼጽጾ';

const FOLD_MAP: Record<string, string> = {};
for (let i = 0; i < FOLD_SRC.length; i++) {
  FOLD_MAP[FOLD_SRC[i]] = FOLD_DST[i];
}

export function fold(text: string): string {
  let out = '';
  for (const ch of text || '') {
    out += FOLD_MAP[ch] ?? ch;
  }
  return out;
}

interface WordItem {
  w: string;
  n?: number;
}

interface NlModel {
  bigram?: Record<string, Record<string, number>>;
  trigram?: Record<string, Record<string, number>>;
}

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

let wordsPromise: Promise<WordItem[]> | null = null;
let modelPromise: Promise<NlModel> | null = null;
let byFold: Map<string, WordItem> | null = null;

async function loadWords(): Promise<WordItem[]> {
  if (!wordsPromise) {
    wordsPromise = fetch(`${DATA_BASE}/amharic_words.json`)
      .then(res => (res.ok ? res.json() : { words: [] }))
      .then((data: { words?: WordItem[] }) => (data.words || []).filter(item => item && item.w))
      .catch(() => []);
  }
  const words = await wordsPromise;
  if (!byFold) {
    byFold = new Map();
    for (const item of words) {
      const key = fold(item.w);
      if (!byFold.has(key)) byFold.set(key, item);
    }
  }
  return words;
}

async function loadModel(): Promise<NlModel> {
  if (!modelPromise) {
    modelPromise = fetch(`${DATA_BASE}/nl_model.json`)
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return modelPromise;
}

/** Warm the dictionary (called when an Amharic document is opened). */
export async function initializeNlp(): Promise<void> {
  await loadWords();
}

function distance(a: string, b: string, limit = 3): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0),
      );
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

const correctionCache = new Map<string, SuggestionItem[]>();

function corrections(word: string, words: WordItem[], limit = 5): SuggestionItem[] {
  const target = fold(word);
  const cached = correctionCache.get(target);
  if (cached) return cached.slice(0, limit);

  const candidates: Array<[number, number, string]> = [];
  for (const item of words) {
    const dist = distance(target, fold(item.w), 2);
    if (dist <= 2) candidates.push([dist, -(item.n ?? 1), item.w]);
  }
  candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));

  const result: SuggestionItem[] = candidates.slice(0, limit).map(([dist, freq, w]) => ({
    word: w,
    distance: dist,
    frequency: -freq,
  }));
  if (correctionCache.size >= 2000) {
    const first = correctionCache.keys().next().value;
    if (first !== undefined) correctionCache.delete(first);
  }
  correctionCache.set(target, result);
  return result;
}

function nextWords(model: NlModel, last: string, second = ''): string[] {
  const counts = new Map<string, number>();
  const trigram = second ? model.trigram?.[`${second}|${last}`] : undefined;
  if (trigram) {
    for (const [word, count] of Object.entries(trigram)) {
      counts.set(word, (counts.get(word) ?? 0) + count * 3);
    }
  }
  const bigram = model.bigram?.[last];
  if (bigram) {
    for (const [word, count] of Object.entries(bigram)) {
      counts.set(word, (counts.get(word) ?? 0) + count);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word]) => word);
}

function partialWord(text: string): string {
  if (!text || WORD_BOUNDARY.test(text[text.length - 1])) return '';
  const match = text.match(ADJACENT_TOKEN);
  return match ? match[0] : '';
}

export async function suggestText(text: string): Promise<SuggestResponse> {
  const words = await loadWords();
  const tokens = text.match(TOKEN) || [];
  const partial = partialWord(text);

  let suggestions: string[] = [];
  if (partial) {
    const prefix = fold(partial);
    suggestions = words
      .filter(item => fold(item.w).startsWith(prefix) && item.w !== partial)
      .slice(0, 8)
      .map(item => item.w);
    if (suggestions.length === 0 && !byFold?.has(prefix)) {
      suggestions = corrections(partial, words, 8).map(item => item.word);
    }
  }

  const last = tokens[tokens.length - 1] || '';
  const second = tokens.length > 1 ? tokens[tokens.length - 2] : '';
  const next = !partial && last ? nextWords(await loadModel(), last, second) : [];

  return { words: suggestions, next, dictionary_size: words.length };
}

export async function checkText(text: string): Promise<CheckWord[]> {
  const words = await loadWords();
  const results: CheckWord[] = [];
  const regex = new RegExp(TOKEN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text || '')) !== null) {
    const word = match[0];
    const known = byFold?.has(fold(word)) ?? false;
    results.push({
      word,
      start: match.index,
      end: match.index + word.length,
      known,
      suggestions: known ? [] : corrections(word, words),
    });
  }
  return results;
}
