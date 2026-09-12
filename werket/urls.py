"""URL configuration for Werket app."""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),

    # Server-rendered auth pages (fallback for the editor's own dialog)
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('password_change/', views.CustomPasswordChangeView.as_view(), name='password_change'),
    path('password_change/done/', views.CustomPasswordChangeDoneView.as_view(), name='password_change_done'),

    # PWA root assets (must stay at root paths for the browser)
    path('manifest.json', views.PwaAssetView.as_view(asset_name='manifest.json', content_type='application/json'), name='manifest'),
    path('sw.js', views.PwaAssetView.as_view(asset_name='sw.js', content_type='text/javascript'), name='sw'),
    path('robots.txt', views.PwaAssetView.as_view(asset_name='robots.txt', content_type='text/plain'), name='robots'),
    path('sitemap.xml', views.PwaAssetView.as_view(asset_name='sitemap.xml', content_type='application/xml'), name='sitemap'),
    path('privacy/', views.PwaAssetView.as_view(asset_name='privacy.html', content_type='text/html; charset=utf-8'), name='privacy'),

    # JSON API used by the editor's account dialog and cloud save.
    # The editor calls these without a trailing slash; APPEND_SLASH would
    # 301-redirect POSTs and drop the body, so register the exact paths.
    path('api/me', views.MeAPIView.as_view(), name='api_me'),
    path('api/login', views.LoginAPIView.as_view(), name='api_login'),
    path('api/register', views.RegisterAPIView.as_view(), name='api_register'),
    path('api/logout', views.LogoutAPIView.as_view(), name='api_logout'),
    path('api/files/save', views.FilesSaveAPIView.as_view(), name='api_files_save'),
    path('api/files', views.FilesListAPIView.as_view(), name='api_files'),
    path('api/suggest', views.SuggestAPIView.as_view(), name='api_suggest'),
    path('api/check', views.CheckAPIView.as_view(), name='api_check'),
]