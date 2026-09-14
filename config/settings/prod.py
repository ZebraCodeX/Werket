"""Production settings for Werket."""
from .base import *  # noqa: F403,F401
import os
import re

DEBUG = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

_csrf = [x for x in config('CSRF_TRUSTED_ORIGINS', default='').split(',') if x]
for _o in ['https://werket.onrender.com', 'https://werket-q5pm.onrender.com']:
    if _o not in _csrf:
        _csrf.append(_o)
CSRF_TRUSTED_ORIGINS = _csrf

_ALLOWED = config('ALLOWED_HOSTS', default='')
ALLOWED_HOSTS = ['*'] + [h for h in _ALLOWED.split(',') if h]

# ---------------------------------------------------------------------------
# Database — try DATABASE_URL, then POSTGRES_*, then fallback to SQLite
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get('DATABASE_URL', '')

def _parse_database_url(url):
    """Parse postgres://user:pass@host:port/dbname?params into a dict."""
    url = url.strip()
    # Strip query params (e.g. ?sslmode=require)
    if '?' in url:
        url = url.split('?')[0]
    # Match: postgres://user:pass@host:port/dbname
    m = re.match(
        r'^(?:postgres(?:ql)?://)(?P<user>[^:@]+)'
        r'(?::(?P<password>[^@]*))?'
        r'@(?P<host>[^:/]+)'
        r'(?::(?P<port>\d+))?'
        r'/(?P<name>[^\s]+)$',
        url,
    )
    if m:
        return m.groupdict()
    return None

if DATABASE_URL:
    parsed = _parse_database_url(DATABASE_URL)
    if parsed:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': parsed.get('name') or 'werket',
                'USER': parsed.get('user') or 'werket',
                'PASSWORD': parsed.get('password') or '',
                'HOST': parsed.get('host') or 'localhost',
                'PORT': parsed.get('port') or '5432',
                'CONN_MAX_AGE': 60,
                'OPTIONS': {'sslmode': 'require'},
            }
        }
    else:
        # DATABASE_URL set but unparseable — log and fail clearly
        import logging
        logging.getLogger('django').error(
            'DATABASE_URL is set but could not be parsed: %s', DATABASE_URL
        )
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': config('POSTGRES_DB', default='werket'),
                'USER': config('POSTGRES_USER', default='werket'),
                'PASSWORD': config('POSTGRES_PASSWORD', default=''),
                'HOST': config('POSTGRES_HOST', default='localhost'),
                'PORT': config('POSTGRES_PORT', default='5432'),
                'CONN_MAX_AGE': 60,
                'OPTIONS': {'sslmode': 'require'},
            }
        }
else:
    # No DATABASE_URL — check for individual POSTGRES_* vars
    _pg_host = os.environ.get('POSTGRES_HOST', '')
    if _pg_host:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.environ.get('POSTGRES_DB', 'werket'),
                'USER': os.environ.get('POSTGRES_USER', 'werket'),
                'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
                'HOST': _pg_host,
                'PORT': os.environ.get('POSTGRES_PORT', '5432'),
                'CONN_MAX_AGE': 60,
                'OPTIONS': {'sslmode': 'require'},
            }
        }
    else:
        # Fallback to SQLite so the app at least starts
        import logging
        logging.getLogger('django').warning(
            'No DATABASE_URL or POSTGRES_HOST set — falling back to SQLite. '
            'Set DATABASE_URL in your Render environment variables.'
        )
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}
