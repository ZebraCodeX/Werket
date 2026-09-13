"""Template tags for resolving Vite-built assets."""
import json
from django import template
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage

register = template.Library()

_manifest = None


def _load_manifest():
    global _manifest
    if _manifest is not None:
        return _manifest
    manifest_path = settings.STATIC_ROOT / '.vite' / 'manifest.json'
    try:
        with open(manifest_path, encoding='utf-8') as f:
            _manifest = json.load(f)
    except (OSError, ValueError):
        _manifest = {}
    return _manifest


@register.inclusion_tag('vite_tags.html', takes_context=False)
def vite_assets(entry_name):
    """Render <link> and <script> tags for a Vite entry.

    Usage: {% vite_assets 'index.html' %}
    """
    manifest = _load_manifest()
    entry = manifest.get(entry_name, {})
    js_file = entry.get('file', '')
    css_files = entry.get('css', [])

    return {
        'js_url': staticfiles_storage.url(js_file) if js_file else '',
        'css_urls': [staticfiles_storage.url(c) for c in css_files],
    }
