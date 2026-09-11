/* tests/test_fidel.js — Node regression tests for every Werket letter
   function: the 31 Fidel families × 7 vowel orders (charFor/ordersFor),
   phonetic QWERTY composition, digraph families, and known words.

   Run:  node tests/test_fidel.js
*/
'use strict';

const F = require('../static/fidel.js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
}

/* ---- every family is present and its roman label is phonetically typable ---- */
ok(F.FAMILIES.length === 31, 'exactly 31 base Fidel families');
ok(F.ROMAN.length === 31, 'roman labels match families');
ok(F.ORDERS.length === 7, 'seven vowel orders');
for (let i = 0; i < F.FAMILIES.length; i++) {
  const family = F.FAMILIES[i];
  const orders = F.ordersFor(family);
  eq(orders.length, 7, family + ' has 7 orders');
  eq(orders[0], family, family + ' first order equals the family base');
  for (let o = 0; o < 7; o++) {
    const ch = F.charFor(family, F.ORDERS[o]);
    eq(ch, orders[o], family + ' + ' + F.ORDERS[o] + ' -> ' + ch);
    const info = F.charInfo(ch);
    ok(info && info.family === family && info.order === o,
      'charInfo(' + ch + ') returns family ' + family + ' order ' + o);
  }
  /* the roman label must compose back to a real letter of that family */
  const roman = F.ROMAN[i];
  if (roman.length === 1) {
    const typed = F.compose(roman + 'e');
    eq(typed, family, roman + 'e -> ' + family);
    const bare = F.compose(roman);
    eq(bare, orders[5], 'bare ' + roman + ' -> silent order ' + orders[5]);
  }
}

/* ---- documented words ---- */
eq(F.compose('selam'), 'ሰላም', 'selam -> ሰላም');
eq(F.compose('buna'), 'ቡና', 'buna -> ቡና');
eq(F.compose('selamawi'), 'ሰላማዊ', 'selamawi -> ሰላማዊ');
eq(F.compose('andiet'), 'እንዴት', 'andiet -> እንዴት');
eq(F.compose('aenjeniya'), 'አንጀኒያ', 'aenjeniya -> አንጀኒያ');
eq(F.compose('biete'), 'ቤተ', 'biete -> ቤተ (5th order via ie)');
eq(F.compose('kiyal'), 'ኪያል', 'kiyal -> ኪያል');
eq(F.compose('shefter'), 'ሸፍተር', 'shefter -> ሸፍተር (digraph sha family)');

/* ---- digraph families: every vowel order must be reachable ---- */
const digraphChecks = [
  ['sh', ['ሸ','ሹ','ሺ','ሻ','ሼ','ሽ','ሾ']],
  ['ch', ['ቸ','ቹ','ቺ','ቻ','ቼ','ች','ቾ']],
  ['nh', ['ኘ','ኙ','ኚ','ኛ','ኜ','ኝ','ኞ']],
  ['ts', ['ጸ','ጹ','ጺ','ጻ','ጼ','ጽ','ጾ']],
  ['ph', ['ፈ','ፉ','ፊ','ፋ','ፌ','ፍ','ፎ']],
];
const vow = ['e','u','i','a','ie','o'];
digraphChecks.forEach(([dig, orders]) => {
  eq(F.compose(dig + 'e'), orders[0], dig + 'e -> ' + orders[0]);
  eq(F.compose(dig + 'u'), orders[1], dig + 'u -> ' + orders[1]);
  eq(F.compose(dig + 'i'), orders[2], dig + 'i -> ' + orders[2]);
  eq(F.compose(dig + 'a'), orders[3], dig + 'a -> ' + orders[3]);
  eq(F.compose(dig + 'ie'), orders[4], dig + 'ie -> ' + orders[4]);
  eq(F.compose(dig), orders[5], 'bare ' + dig + ' -> ' + orders[5]);
  eq(F.compose(dig + 'o'), orders[6], dig + 'o -> ' + orders[6]);
  void vow;
});

/* ---- families that were previously not phonetic-typable ---- */
eq(F.compose('Ke'), 'ኸ', 'Ke -> ኸ (previously broken)');
eq(F.compose('Ee'), 'ዐ', 'Ee -> ዐ (previously broken)');
eq(F.compose('Ze'), 'ዠ', 'Ze -> ዠ (previously broken)');
eq(F.compose('Pe'), 'ጰ', 'Pe -> ጰ (previously broken)');
eq(F.compose('De'), 'ፀ', 'De -> ፀ');
eq(F.compose('He'), 'ሐ', 'He -> ሐ');
eq(F.compose('Se'), 'ሠ', 'Se -> ሠ');

/* ---- vowel-initial and silent-order behaviour ---- */
eq(F.compose('a'), 'እ', 'bare a -> እ (silent order of the አ family)');
eq(F.compose('ae'), 'አ', 'ae -> አ (first order of the አ family)');
eq(F.compose('au'), 'ኡ', 'au -> ኡ');
eq(F.compose('ai'), 'ኢ', 'ai -> ኢ');
eq(F.compose('aa'), 'ኣ', 'aa -> ኣ');
eq(F.compose('ao'), 'ኦ', 'ao -> ኦ');
eq(F.compose('h'), 'ህ', 'bare h -> ህ');

/* ---- uppercasing extras ---- */
eq(F.compose('Ve'), 'ቨ', 'Ve -> ቨ');
eq(F.compose('Fe'), 'ፈ', 'Fe -> ፈ');
eq(F.compose('ve'), 'ቨ', 've -> ቨ');

/* ---- non-letter input passes through unchanged ---- */
eq(F.compose('selam 123'), 'ሰላም 123', 'non-letter runes pass through');
eq(F.compose(''), '', 'empty input');

if (fail === 0) {
  console.log('FIDEL OK (' + pass + ' checks)');
  process.exit(0);
} else {
  console.log('FIDEL FAILED (' + fail + '/' + (pass + fail) + ')');
  process.exit(1);
}