# AGENTS.md

Werket is a Django backend + React (Vite) frontend Amharic/English editor, deployed as a single Docker container on Render.

## Build/test/deploy commands

- Backend venv: `.venv/bin/python` (Python 3.14), settings via `DJANGO_SETTINGS_MODULE`.
- Tests: `DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py test` (all 13 must pass).
- Django sanity: `.venv/bin/python manage.py check`.
- Frontend build: `cd frontend && npm run build` (runs `tsc -b && vite build`).
- Frontend lint: `cd frontend && npm run lint` (oxlint).
- Local "prod-like" verification without Docker (no docker access on this machine):
  `cd frontend && npm run build` then
  `DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py collectstatic --noinput`,
  then confirm `staticfiles/.vite/manifest.json` exists and `{% vite_assets 'index.html' %}` renders CSS/JS links.
- Deploy: push to `master`; Render auto-deploys via `render.yaml` (Docker). Entrypoint runs `migrate` then gunicorn.

## Architecture gotchas (do not "fix" blindly)

- **Frontend build output lands in repo-root `../staticfiles`** (Vite `outDir`). That dir is in `.gitignore` AND `.dockerignore`.
- **`staticfiles/` is not committed** — it is produced inside the Docker image. The multi-stage `Dockerfile` runs `npm ci && npm run build` in a node stage (outputs to `/build/staticfiles`), copies it to `/app/staticfiles`, then runs `collectstatic`. If you change the Dockerfile, keep this chain: node stage → `COPY --from=frontend /build/staticfiles ./staticfiles` → `collectstatic`.
- **`templates/base.html` loads the bundle via `{% vite_assets 'index.html' %}`** (`werket/templatetags/vite.py`), which reads `STATIC_ROOT/.vite/manifest.json` at runtime. If that template tag renders empty, the bundle is missing — re-run the frontend build (the #1 cause of blank pages).
- **Do NOT re-create `werket/api.py`.** It was removed; the dictionary/NLP functions (`suggest`, `check`, `fold`, …) now live in `werket/api/__init__.py`. `werket/api/` is a package (`views.py`, `urls.py`, `serializers.py`). A same-named module + package caused circular imports.
- **`/workspace/` API returns/accepts the workspace JSON blob directly** (top-level `files`, `activeId`, `font`, …), not a nested `{data: {...}}`. Frontend `workspaceApi.save` uses POST `/api/workspace/`, load uses GET.
- DRF `SessionAuthentication` returns **403** (not 401) for anonymous users; the frontend only reacts to 401.
- Auth: users are created with `username == email`. Standalone pages at `/login/` / `/signup/` use `werket/forms.py` (`LoginForm`, `SignupForm`) and Django sessions; the React `AuthDialog` uses the DRF endpoints `/api/auth/login|register/`.
- PWA root assets (`/manifest.json`, `/sw.js`, `/robots.txt`, `/sitemap.xml`, `/privacy/`) are served by `PwaAssetView`, which scans `STATICFILES_DIRS` then falls back to `STATIC_ROOT`. The files themselves come from `frontend/public/` via the Vite build.
- `config/settings/prod.py`: DB from `DATABASE_URL` (falls back to `POSTGRES_*`, then SQLite with a warning). `config/settings/base.py` has `STATIC_ROOT = BASE_DIR / 'staticfiles'`, `STATICFILES_DIRS = []`.
- Amharic NLP data (`data/amharic_words.json`, `data/nl_model.json`) is loaded via `DATA_DIR`; the 10 MB `nl_model.json` is what the dictionary endpoints depend on.

## Commands that will NOT work here

- `docker build` — no docker group access / no passwordless sudo. Use the local simulation above instead.
- `python manage.py test` without `DJANGO_SETTINGS_MODULE` — not set by default in this shell.