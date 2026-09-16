# Werket

[![Latest release](https://img.shields.io/github/v/release/ZebraCodeX/Werket?sort=semver&label=download)](https://github.com/ZebraCodeX/Werket/releases/latest)
[![Android build](https://github.com/ZebraCodeX/Werket/actions/workflows/android.yml/badge.svg)](https://github.com/ZebraCodeX/Werket/actions/workflows/android.yml)
[![Desktop build](https://github.com/ZebraCodeX/Werket/actions/workflows/desktop.yml/badge.svg)](https://github.com/ZebraCodeX/Werket/actions/workflows/desktop.yml)

Werket is a standalone Amharic file editor inspired by Pages. It combines a file tree, tabs, a paper-like editor, Fidel
phonetic typing, direct seven-order letter families, dictionary-backed spell
checking, predictive words/sentences, book templates, local document storage,
import, export, printing, and a mobile/desktop-installable PWA.

## Download

**[⬇ Download the latest release](https://github.com/ZebraCodeX/Werket/releases/latest)** — or grab a specific build:

| Platform | Download | Notes |
| --- | --- | --- |
| **Android** | [Werket.apk](https://github.com/ZebraCodeX/Werket/releases/latest/download/Werket.apk) | Install (allow "unknown sources"). `Werket.aab` is the Play Store bundle. |
| **Windows** | [Werket-Setup.exe](https://github.com/ZebraCodeX/Werket/releases/latest/download/Werket-Setup.exe) | Installer. Unsigned, so SmartScreen may warn → "More info" → "Run anyway". |
| **Linux** | [Werket.AppImage](https://github.com/ZebraCodeX/Werket/releases/latest/download/Werket.AppImage) · [Werket.deb](https://github.com/ZebraCodeX/Werket/releases/latest/download/Werket.deb) | `chmod +x Werket.AppImage && ./Werket.AppImage`, or install the `.deb`. |
| **Web (PWA)** | [Deploy to Render](#deploy) | Installs from the browser too. |

The installed apps work **offline** (documents, Fidel keyboard, spell-check and
predictions all run on-device). Signing in is optional and enables cloud sync
and AI generation when the server is reachable.

## Run (Django)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

Open `http://localhost:8000`. Create an account from the login page. Edits
autosave to the browser immediately; use **Save** in the topbar to sync the
workspace to your account on the server. A superuser for the Django admin is
created with:

```bash
.venv/bin/python manage.py createsuperuser   # then visit /admin/
```

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ZebraCodeX/Werket)

The Render Blueprint uses the included `render.yaml` and `Dockerfile`.

The home screen and **New** menu offer Blank document, Letter, Daily journal,
Meeting notes, and Book project templates. The Book project creates an outline,
characters file, research notes, and chapter files in a `chapters/` folder.
Font family and size are adjustable in the editor toolbar. The on-screen
Amharic keyboard is available on every device from the ⌨ toggle (in the toolbar,
and in the topbar on phones). It opens only when you ask, and while it is docked
it suppresses the device keyboard so the two never fight.

Werket is installable as a PWA and ready for app-store packaging via PWABuilder
(icons, maskable icons, and an Apple touch icon are included), and is
indexed for search engines via `robots.txt`, `sitemap.xml`, and structured data.

## Input

- Type `selam` to compose `ሰላም`, `buna` to compose `ቡና`.
- Tap a Fidel family key to choose its seven vowel orders.
- Use the prediction strip to complete words or insert next words.
- Use `Tab` to accept the first suggestion when the editor is focused.

The phonetic approach follows the established GFF/Keyman Amharic convention:
consonant families are composed with `e,u,i,a,ie,silent,o`, while uppercase
keys provide emphatic families.
