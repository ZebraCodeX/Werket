/**
 * Fidel (Ethiopic) composition logic.
 * Ported from static/fidel.js
 */

export const FAMILIES = [
  'ሀ', 'ለ', 'ሐ', 'መ', 'ሠ', 'ረ', 'ሰ', 'ሸ', 'ቀ', 'በ', 'ተ', 'ቸ',
  'ኀ', 'ነ', 'ኘ', 'አ', 'ከ', 'ኸ', 'ወ', 'ዐ', 'ዘ', 'ዠ', 'የ', 'ደ',
  'ጀ', 'ገ', 'ጠ', 'ጨ', 'ጰ', 'ጸ', 'ፀ',
];

export const ROMAN = [
  'h', 'l', 'H', 'm', 'S', 'r', 's', 'sh', 'q', 'b', 't', 'c',
  'x', 'n', 'N', 'a', 'k', 'K', 'w', 'E', 'z', 'Z', 'y', 'd',
  'j', 'g', 'T', 'C', 'P', 'ts', 'D',
];

export const ORDERS = ['e', 'u', 'i', 'a', 'ie', 'silent', 'o'];

export const KEYBOARD_LAYERS = {
  fidel: FAMILIES,
  numbers: ['1','2','3','4','5','6','7','8','9','0','-','='],
  symbols: ['!','@','#','$','%','^','&','*','(',')','_','+','[',']','{','}','|','\\',':',';','"',"'",'<','>','?','/'],
} as const;

export const FUNCTION_KEYS = {
  fidel: [
    { label: '⌫', value: 'backspace', type: 'fn' as const },
    { label: '123', value: 'layer', type: 'fn' as const },
    { label: 'Space', value: ' ', type: 'space' as const },
    { label: 'Enter', value: '\n', type: 'enter' as const },
  ],
  numbers: [
    { label: '⌫', value: 'backspace', type: 'fn' as const },
    { label: 'ABC', value: 'layer', type: 'fn' as const },
    { label: 'Space', value: ' ', type: 'space' as const },
    { label: 'Enter', value: '\n', type: 'enter' as const },
  ],
  symbols: [
    { label: '⌫', value: 'backspace', type: 'fn' as const },
    { label: 'ABC', value: 'layer', type: 'fn' as const },
    { label: 'Space', value: ' ', type: 'space' as const },
    { label: 'Enter', value: '\n', type: 'enter' as const },
  ],
};

export const VOWELS: Record<string, number> = {
  e: 0,
  u: 1,
  i: 2,
  a: 3,
  ie: 4,
  ee: 4,
  '': 5,
  silent: 5,
  o: 6,
};

export const DIGRAPHS: Record<string, string> = {
  sh: 'ሸ',
  ch: 'ቸ',
  nh: 'ኘ',
  ts: 'ጸ',
  ph: 'ፈ',
};

export const PHONETIC: Record<string, string> = {
  h: 'ሀ', H: 'ሐ', l: 'ለ', m: 'መ', s: 'ሰ', r: 'ረ', S: 'ሠ',
  b: 'በ', t: 'ተ', c: 'ቸ', C: 'ጨ', q: 'ቀ', k: 'ከ', x: 'ኀ',
  n: 'ነ', N: 'ኘ', a: 'አ', w: 'ወ', z: 'ዘ', Z: 'ዠ', y: 'የ',
  d: 'ደ', j: 'ጀ', g: 'ገ', T: 'ጠ', p: 'ፐ', f: 'ፈ', v: 'ቨ',
  D: 'ፀ', K: 'ኸ', E: 'ዐ', P: 'ጰ', F: 'ፈ', V: 'ቨ',
};

/**
 * Get the character for a family at a specific vowel order.
 */
export function charFor(family: string, order: string | number): string {
  let orderIndex: number;
  if (typeof order === 'string' && order in VOWELS) {
    orderIndex = VOWELS[order];
  } else {
    orderIndex = parseInt(String(order), 10);
    if (isNaN(orderIndex)) orderIndex = 0;
    orderIndex = Math.max(0, Math.min(6, orderIndex));
  }
  const baseCode = family.codePointAt(0)!;
  return String.fromCodePoint(baseCode + orderIndex);
}

/**
 * Get all 7 vowel orders for a family.
 */
export function ordersFor(family: string): string[] {
  const base = family.codePointAt(0)!;
  return Array.from({ length: 7 }, (_, o) => String.fromCodePoint(base + o));
}

/**
 * Consume a vowel from the input string.
 */
function consumeVowel(raw: string, i: number): { vowel: string; i: number } {
  const two = raw.slice(i, i + 2).toLowerCase();
  if (two === 'ie' || two === 'ee') return { vowel: two, i: i + 2 };
  const one = (raw[i] || '').toLowerCase();
  if (one in VOWELS) return { vowel: one, i: i + 1 };
  return { vowel: '', i };
}

/**
 * Compose phonetic QWERTY input into Ethiopic text.
 */
export function compose(raw: string): string {
  let out = '';
  let i = 0;
  const len = raw.length;

  while (i < len) {
    let family: string | null = null;
    const pair = raw.slice(i, i + 2).toLowerCase();

    if (pair in DIGRAPHS) {
      family = DIGRAPHS[pair];
      i += 2;
    } else if (raw[i] in PHONETIC) {
      family = PHONETIC[raw[i]];
      i++;
    }

    if (!family) {
      out += raw[i];
      i++;
      continue;
    }

    const next = consumeVowel(raw, i);
    i = next.i;
    out += charFor(family, next.vowel);
  }

  return out;
}

/**
 * Get family and order info for an Ethiopic character.
 */
export function charInfo(ch: string): { family: string; order: number } | null {
  const code = ch.codePointAt(0);
  if (!code) return null;

  for (let f = 0; f < FAMILIES.length; f++) {
    const base = FAMILIES[f].codePointAt(0)!;
    if (code >= base && code <= base + 6) {
      return { family: FAMILIES[f], order: code - base };
    }
  }
  return null;
}

/**
 * Check if a character is Ethiopic.
 */
export function isEthiopic(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= 0x1200 && code <= 0x137F;
}

/**
 * Get the base family character for a given Ethiopic character.
 */
export function getFamily(ch: string): string | null {
  const info = charInfo(ch);
  return info ? info.family : null;
}

/**
 * Get the vowel order (0-6) for a given Ethiopic character.
 */
export function getOrder(ch: string): number | null {
  const info = charInfo(ch);
  return info ? info.order : null;
}