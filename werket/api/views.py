"""DRF API Views for Werket."""
import json
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.authtoken.models import Token

from ..models import Workspace
from .serializers import (
    UserSerializer,
    WorkspaceSerializer,
    WorkspaceDataSerializer,
    SuggestionSerializer,
    CheckSerializer,
    AiGenerateSerializer,
    AiGenerateResponseSerializer,
)
from ..api import suggest, check
from ..ai_engine import generate as ai_generate, _llm_available


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    """Return CSRF token for the frontend."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class HealthView(APIView):
    """Liveness/version probe used by the packaged apps and Render."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'werket', 'version': '1.0.0'})


class AuthViewSet(viewsets.ViewSet):
    """Authentication endpoints."""
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Return current user or null."""
        if request.user.is_authenticated:
            return Response({
                'user': {
                    'name': request.user.first_name or request.user.email or request.user.username or 'Writer',
                    'email': request.user.email or '',
                }
            })
        return Response({'user': None})

    @action(detail=False, methods=['post'])
    def login(self, request):
        """Sign in with email + password."""
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''

        if not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = User.objects.filter(email__iexact=email).values_list('username', flat=True).first()
        user = authenticate(request, username=username or email, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'user': {
                'name': user.first_name or user.email or user.username or 'Writer',
                'email': user.email or '',
            },
            'token': token.key,
        })

    @action(detail=False, methods=['post'])
    def register(self, request):
        """Create an account and sign in."""
        name = (request.data.get('name') or '').strip()
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''

        if not email or len(password) < 4:
            return Response(
                {'error': 'Email and a 4+ character password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {'error': 'An account with that email already exists'},
                status=status.HTTP_409_CONFLICT
            )

        user = User.objects.create_user(username=email, email=email, password=password)
        if name:
            user.first_name = name
            user.save(update_fields=['first_name'])

        Workspace.objects.get_or_create(user=user)
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'user': {
                'name': user.first_name or user.email or user.username or 'Writer',
                'email': user.email or '',
            },
            'token': token.key,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Sign out and revoke the token (web uses session cookies)."""
        if isinstance(request.auth, Token):
            request.auth.delete()
        logout(request)
        return Response({'ok': True})


class WorkspaceViewSet(viewsets.ViewSet):
    """One cloud-synced workspace per user (GET/POST on /api/workspace/).

    The frontend stores its entire editor state as a single JSON blob and
    round-trips it here verbatim; POST merges/upserts the blob.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def _get_workspace(self, request):
        workspace, _ = Workspace.objects.get_or_create(user=request.user)
        return workspace

    def list(self, request):
        """Return the current user's workspace data dict."""
        workspace = self._get_workspace(request)
        return Response(workspace.data)

    def create(self, request):
        """Save (upsert) the current user's workspace data."""
        workspace = self._get_workspace(request)
        data_serializer = WorkspaceDataSerializer(data=request.data)
        data_serializer.is_valid(raise_exception=True)
        workspace.data.update(data_serializer.validated_data)
        workspace.save()
        return Response(workspace.data)


class DictionaryViewSet(viewsets.ViewSet):
    """Public dictionary endpoints for spell check and suggestions."""
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def suggest(self, request):
        """Get word suggestions for text."""
        text = request.query_params.get('text', '')
        result = suggest(text)
        serializer = SuggestionSerializer(result)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def check(self, request):
        """Check spelling of text."""
        text = request.query_params.get('text', '')
        result = {'text': text, 'words': check(text)}
        serializer = CheckSerializer(result)
        return Response(serializer.data)


class AiGenerateView(APIView):
    """AI content generation endpoint."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AiGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data['topic']
        lang = serializer.validated_data['lang']
        content_type = serializer.validated_data['type']

        try:
            content = ai_generate(topic, lang, content_type)
            method = 'llm' if _llm_available() else 'nlp'
            response_data = {
                'content': content,
                'topic': topic,
                'lang': lang,
                'type': content_type,
                'method': method,
            }
            resp_serializer = AiGenerateResponseSerializer(response_data)
            return Response(resp_serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )