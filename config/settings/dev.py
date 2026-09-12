"""Development settings for Werket."""
from .base import *  # noqa: F403,F401

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

INSTALLED_APPS += ['django_extensions']

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'