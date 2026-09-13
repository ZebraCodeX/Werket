"""Views for Werket - PWA asset serving only."""
from django.conf import settings
from django.http import Http404, HttpResponse
from django.views import View


class PwaAssetView(View):
    """Serve PWA static files at their canonical root URLs.

    The manifest, service worker, robots.txt, sitemap.xml, and privacy page
    must live at the app root so the browser finds them at fixed paths; Django
    would otherwise only expose them under /static/.
    """
    asset_name = None
    content_type = 'text/plain'

    def get(self, request):
        for directory in settings.STATICFILES_DIRS:
            candidate = directory / self.asset_name
            if candidate.is_file():
                try:
                    body = candidate.read_bytes()
                except OSError:
                    continue
                return HttpResponse(body, content_type=self.content_type)
        raise Http404('not found')