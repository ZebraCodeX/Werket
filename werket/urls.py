"""URL configuration for Werket app."""
from django.urls import path
from django.contrib.auth.views import PasswordChangeDoneView
from . import views

urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('password_change/', views.CustomPasswordChangeView.as_view(), name='password_change'),
    path('password_change/done/', PasswordChangeDoneView.as_view(template_name='registration/password_change_done.html'), name='password_change_done'),

    # PWA root assets (must stay at root paths for the browser)
    path('manifest.json', views.PwaAssetView.as_view(asset_name='manifest.json', content_type='application/json'), name='manifest'),
    path('sw.js', views.PwaAssetView.as_view(asset_name='sw.js', content_type='text/javascript'), name='sw'),
    path('robots.txt', views.PwaAssetView.as_view(asset_name='robots.txt', content_type='text/plain'), name='robots'),
    path('sitemap.xml', views.PwaAssetView.as_view(asset_name='sitemap.xml', content_type='application/xml'), name='sitemap'),
    path('privacy/', views.PwaAssetView.as_view(asset_name='privacy.html', content_type='text/html; charset=utf-8'), name='privacy'),

    # API endpoints
    path('api/suggest/', views.SuggestAPIView.as_view(), name='api_suggest'),
    path('api/check/', views.CheckAPIView.as_view(), name='api_check'),
    path('api/documents/', views.DocumentListView.as_view(), name='api_documents'),
    path('api/documents/create/', views.DocumentCreateView.as_view(), name='api_document_create'),
    path('api/documents/<int:pk>/update/', views.DocumentUpdateView.as_view(), name='api_document_update'),
    path('api/documents/<int:pk>/delete/', views.DocumentDeleteView.as_view(), name='api_document_delete'),
    path('api/preferences/', views.UserPreferencesView.as_view(), name='api_preferences'),
]