# Werket

Werket is a standalone Amharic file editor inspired by VS Code, Pages, and
Word. It combines a workspace/file tree, tabs, a paper-like editor, Fidel
phonetic typing, direct seven-order letter families, dictionary-backed spell
checking, predictive words/sentences, book templates, local document storage,
import, export, printing, and a mobile/desktop-installable PWA.

## Run

```bash
python3 app.py
```

Open `http://localhost:8765`. On a phone or tablet, use **Install app** or
**Add to Home screen**. Documents are saved locally in the browser.

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ZebraCodeX/Werket)

The Render Blueprint uses the included `render.yaml` and `Dockerfile`.

The home screen and **New** menu offer Blank document, Letter, Daily journal,
Meeting notes, and Book project templates. The Book project creates an outline,
characters file, research notes, and chapter files in a `chapters/` folder.
Font family and size are adjustable in the editor toolbar. On phones, an
optional Amharic keyboard floats over the document (with the device keyboard
suppressed); laptops with a physical keyboard do not show that control.

Werket is installable as a PWA and ready for app-store packaging via PWABuilder
(icons, maskable icons, Apple touch icon, and screenshots are included), and is
indexed for search engines via `robots.txt`, `sitemap.xml`, and structured data.

## Input

- Type `selam` to compose `ሰላም`, `buna` to compose `ቡና`.
- Tap a Fidel family key to choose its seven vowel orders.
- Use the prediction strip to complete words or insert next words.
- Use `Tab` to accept the first suggestion when the editor is focused.

The phonetic approach follows the established GFF/Keyman Amharic convention:
consonant families are composed with `e,u,i,a,ie,silent,o`, while uppercase
keys provide emphatic families.
