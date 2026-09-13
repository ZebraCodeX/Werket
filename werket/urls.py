"""URL configuration for Werket app."""
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

from . import views

urlpatterns = [
    # API endpoints
    path('api/', include('werket.api.urls')),

    # PWA root assets (must stay at root paths for the browser)
    path('manifest.json', views.PwaAssetView.as_view(
        asset_name='manifest.json',
        content_type='application/json'
    ), name='manifest'),
    path('sw.js', views.PwaAssetView.as_view(
        asset_name='sw.js',
        content_type='text/javascript'
    ), name='sw'),
    path('robots.txt', views.PwaAssetView.as_view(
        asset_name='robots.txt',
        content_type='text/plain'
    ), name='robots'),
    path('sitemap.xml', views.PwaAssetView.as_view(
        asset_name='sitemap.xml',
        content_type='application/xml'
    ), name='sitemap'),
    path('privacy/', views.PwaAssetView.as_view(
        asset_name='privacy.html',
        content_type='text/html; charset=utf-8'
    ), name='privacy'),

    # SPA entry point - catch all other routes
    path('', TemplateView.as_view(template_name='base.html'), name='index'),
    path('<path:path>', TemplateView.as_view(template_name='base.html'), name='spa_catch_all'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)