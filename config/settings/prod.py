"""Production settings for Werket."""
from .base import *  # noqa: F403,F401

DEBUG = False

# Render terminates TLS at its proxy and forwards http internally with
# X-Forwarded-Proto: https. Without this Django thinks every request is
# http and SECURE_SSL_REDIRECT would loop on the health-check.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'false').lower() == 'true'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

_csrf = [x for x in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if x]
for _o in ['https://werket.onrender.com', 'https://werket-q5pm.onrender.com']:
    if _o not in _csrf:
        _csrf.append(_o)
CSRF_TRUSTED_ORIGINS = _csrf

# Always include wildcard to avoid DisallowedHost with Render proxy env vars
_ALLOWED = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = ['*'] + [h for h in _allowed.split(',') if h]

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}