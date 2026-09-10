# Werket

Werket is a standalone Amharic writing workspace inspired by Pages and Word.
It combines a paper-like editor, Fidel phonetic typing, direct seven-order
letter families, predictive words/sentences, local document storage, import,
export, printing, and a mobile/desktop-installable PWA.

## Run

```bash
python3 app.py
```

Open `http://localhost:8765`. On a phone or tablet, use **Install app** or
**Add to Home screen**. Documents are saved locally in the browser.

## Input

- Type `selam` to compose `ሰላም`, `buna` to compose `ቡና`.
- Tap a Fidel family key to choose its seven vowel orders.
- Use the prediction strip to complete words or insert next words.
- Use `Tab` to accept the first suggestion when the editor is focused.

The phonetic approach follows the established GFF/Keyman Amharic convention:
consonant families are composed with `e,u,i,a,ie,silent,o`, while uppercase
keys provide emphatic families.
