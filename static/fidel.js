/* Werket Fidel tables + phonetic QWERTY composer.
   Pure logic — works in the browser (window.WerketFidel) and in Node
   (module.exports) so every letter function can be tested without a browser.

   The seven vowel orders follow the GFF/Keyman Amharic convention:
     1=e  2=u  3=i  4=a  5=ie/ee  6=silent  7=o
   A consonant with no following vowel letter produces its silent (6th) order,
   so `selam` -> ሰላም and `buna` -> ቡና. */
(function (global) {
  'use strict';

  var FAMILIES = ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ','ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ','ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ','ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'];
  var ROMAN = ['h','l','H','m','S','r','s','sh','q','b','t','c','x','n','N','a','k','K','w','E','z','Z','y','d','j','g','T','C','P','ts','D'];
  var ORDERS = ['e','u','i','a','ie','silent','o'];
  var VOWELS = { e: 0, u: 1, i: 2, a: 3, ie: 4, ee: 4, '': 5, silent: 5, o: 6 };
  var DIGRAPHS = { sh: 'ሸ', ch: 'ቸ', nh: 'ኘ', ts: 'ጸ', ph: 'ፈ' };
  var PHONETIC = {
    h: 'ሀ', H: 'ሐ', l: 'ለ', m: 'መ', s: 'ሰ', r: 'ረ', S: 'ሠ', b: 'በ', t: 'ተ',
    c: 'ቸ', C: 'ጨ', q: 'ቀ', k: 'ከ', x: 'ኀ', n: 'ነ', N: 'ኘ', a: 'አ', w: 'ወ',
    z: 'ዘ', Z: 'ዠ', y: 'የ', d: 'ደ', j: 'ጀ', g: 'ገ', T: 'ጠ', p: 'ፐ', f: 'ፈ',
    v: 'ቨ', D: 'ፀ', K: 'ኸ', E: 'ዐ', P: 'ጰ', F: 'ፈ', V: 'ቨ'
  };

  function charFor(family, order) {
    if (Object.prototype.hasOwnProperty.call(VOWELS, String(order))) {
      order = VOWELS[String(order)];
    } else {
      order = parseInt(order, 10);
      if (isNaN(order)) order = 0;
      order = Math.max(0, Math.min(6, order));
    }
    return String.fromCodePoint(String(family).codePointAt(0) + order);
  }

  function ordersFor(family) {
    var out = [], base = String(family).codePointAt(0);
    for (var o = 0; o < 7; o++) out.push(String.fromCodePoint(base + o));
    return out;
  }

  /* Reads the vowel order that follows a consonant, returning {vowel, i}. */
  function consumeVowel(raw, i) {
    var two = raw.slice(i, i + 2).toLowerCase();
    if (two === 'ie' || two === 'ee') return { vowel: two, i: i + 2 };
    var one = (raw[i] || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(VOWELS, one)) return { vowel: one, i: i + 1 };
    return { vowel: '', i: i };
  }

  function compose(raw) {
    var out = '', i = 0, len = (raw || '').length;
    while (i < len) {
      var family = null;
      var pair = raw.slice(i, i + 2).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(DIGRAPHS, pair)) { family = DIGRAPHS[pair]; i += 2; }
      else if (Object.prototype.hasOwnProperty.call(PHONETIC, raw[i])) { family = PHONETIC[raw[i]]; i++; }
      if (!family) { out += raw[i]; i++; continue; }
      var next = consumeVowel(raw, i);
      i = next.i;
      out += charFor(family, next.vowel);
    }
    return out;
  }

  /* Inverse: given an Ethiopic character, which family and order is it? */
  function charInfo(ch) {
    var code = String(ch).codePointAt(0);
    for (var f = 0; f < FAMILIES.length; f++) {
      var base = FAMILIES[f].codePointAt(0);
      if (code >= base && code <= base + 6) {
        return { family: FAMILIES[f], order: code - base };
      }
    }
    return null;
  }

  var WerketFidel = {
    FAMILIES: FAMILIES,
    ROMAN: ROMAN,
    ORDERS: ORDERS,
    VOWELS: VOWELS,
    DIGRAPHS: DIGRAPHS,
    PHONETIC: PHONETIC,
    charFor: charFor,
    ordersFor: ordersFor,
    compose: compose,
    charInfo: charInfo
  };
  global.WerketFidel = WerketFidel;
  if (typeof module !== 'undefined' && module.exports) module.exports = WerketFidel;
})(typeof window !== 'undefined' ? window : this);