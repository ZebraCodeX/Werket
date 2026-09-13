"""API URL configuration for Werket."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, WorkspaceViewSet, DictionaryViewSet, CsrfTokenView, AiGenerateView

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'workspace', WorkspaceViewSet, basename='workspace')
router.register(r'dictionary', DictionaryViewSet, basename='dictionary')

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='csrf_token'),
    path('ai/generate/', AiGenerateView.as_view(), name='ai_generate'),
    path('', include(router.urls)),
]