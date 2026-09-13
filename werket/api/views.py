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

from ..models import Workspace
from .serializers import (
    UserSerializer,
    WorkspaceSerializer,
    WorkspaceDataSerializer,
    SuggestionSerializer,
    CheckSerializer,
)
from ..api import suggest, check


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    """Return CSRF token for the frontend."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


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
        return Response({
            'user': {
                'name': user.first_name or user.email or user.username or 'Writer',
                'email': user.email or '',
            }
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

        return Response({
            'user': {
                'name': user.first_name or user.email or user.username or 'Writer',
                'email': user.email or '',
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Sign out the current session."""
        logout(request)
        return Response({'ok': True})


class WorkspaceViewSet(viewsets.ModelViewSet):
    """Workspace CRUD for the signed-in user."""
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Workspace.objects.filter(user=self.request.user)

    def get_object(self):
        workspace, _ = Workspace.objects.get_or_create(user=self.request.user)
        return workspace

    def retrieve(self, request, *args, **kwargs):
        """Return the full workspace data."""
        workspace = self.get_object()
        serializer = self.get_serializer(workspace)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """Replace the entire workspace data."""
        workspace = self.get_object()
        data_serializer = WorkspaceDataSerializer(data=request.data)
        data_serializer.is_valid(raise_exception=True)
        workspace.data = data_serializer.validated_data
        workspace.save()
        return Response(WorkspaceSerializer(workspace).data)

    def partial_update(self, request, *args, **kwargs):
        """Partial update of workspace data."""
        workspace = self.get_object()
        data_serializer = WorkspaceDataSerializer(data=request.data, partial=True)
        data_serializer.is_valid(raise_exception=True)
        workspace.data.update(data_serializer.validated_data)
        workspace.save()
        return Response(WorkspaceSerializer(workspace).data)


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