"""Production settings for Werket."""
from .base import *  # noqa: F403,F401

DEBUG = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB', default='werket'),
        'USER': config('POSTGRES_USER', default='werket'),
        'PASSWORD': config('POSTGRES_PASSWORD', default=''),
        'HOST': config('POSTGRES_HOST', default='localhost'),
        'PORT': config('POSTGRES_PORT', default='5432'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'sslmode': 'require',
        },
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