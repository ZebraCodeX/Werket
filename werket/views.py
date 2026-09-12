"""Views for Werket.

The editor is a client-side SPA with an account dialog. It talks to a small
JSON API: /api/me, /api/login, /api/register, /api/logout, /api/files and
/api/files/save, plus /api/suggest and /api/check for the dictionary.

Auth is Django session auth; the API accepts username = email. The editor
posts JSON without a CSRF header (matching the original standalone server),
so these API views are marked csrf_exempt. Everything else stays protected.
"""
import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.views import LoginView, LogoutView, PasswordChangeView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import Http404, HttpResponse, JsonResponse
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import FormView, TemplateView

from .api import check, suggest
from .forms import BootstrapAuthenticationForm, UserRegistrationForm
from .models import Workspace


def _user_payload(user):
    name = (user.first_name or '').strip()
    if not name:
        name = user.email or user.username or 'Writer'
    return {'name': name, 'email': user.email or ''}


class IndexView(TemplateView):
    """Main editor page. Public - the editor works without an account."""
    template_name = 'werket/index.html'


class CustomLoginView(LoginView):
    """Server-rendered login page, kept as a fallback for the editor dialog."""
    template_name = 'registration/login.html'
    form_class = BootstrapAuthenticationForm
    redirect_authenticated_user = True


class CustomLogoutView(LogoutView):
    next_page = reverse_lazy('login')


class RegisterView(FormView):
    """Server-rendered registration page, kept as a fallback."""
    template_name = 'registration/register.html'
    form_class = UserRegistrationForm
    success_url = reverse_lazy('index')

    def form_valid(self, form):
        user = form.save()
        Workspace.objects.get_or_create(user=user)
        login(self.request, user)
        return super().form_valid(form)


class CustomPasswordChangeView(LoginRequiredMixin, PasswordChangeView):
    template_name = 'registration/password_change.html'
    success_url = reverse_lazy('password_change_done')


class CustomPasswordChangeDoneView(TemplateView):
    template_name = 'registration/password_change_done.html'


@method_decorator(csrf_exempt, name='dispatch')
class MeAPIView(View):
    """Return the signed-in user (or null) for the account dialog."""

    def get(self, request):
        if request.user.is_authenticated:
            return JsonResponse({'user': _user_payload(request.user)})
        return JsonResponse({'user': None})


@method_decorator(csrf_exempt, name='dispatch')
class LoginAPIView(View):
    """Sign in with email + password over JSON, establishing a session."""

    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            body = {}
        email = (body.get('email') or '').strip()
        password = body.get('password') or ''
        if not email or not password:
            return JsonResponse({'error': 'Email and password are required'}, status=400)
        username = User.objects.filter(email__iexact=email).values_list('username', flat=True).first()
        user = authenticate(request, username=username or email, password=password)
        if user is None:
            return JsonResponse({'error': 'Invalid email or password'}, status=401)
        login(request, user)
        return JsonResponse({'user': _user_payload(user)})


@method_decorator(csrf_exempt, name='dispatch')
class RegisterAPIView(View):
    """Create an account and sign in."""

    def post(self, request):
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            body = {}
        name = (body.get('name') or '').strip()
        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        if not email or len(password) < 4:
            return JsonResponse({'error': 'Email and a 4+ character password are required'}, status=400)
        if User.objects.filter(email__iexact=email).exists():
            return JsonResponse({'error': 'An account with that email already exists'}, status=409)
        user = User.objects.create_user(username=email, email=email, password=password)
        if name:
            user.first_name = name
            user.save(update_fields=['first_name'])
        login(request, user)
        return JsonResponse({'user': _user_payload(user)}, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class LogoutAPIView(View):
    """Sign out the current session."""

    def post(self, request):
        logout(request)
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class FilesSaveAPIView(View):
    """Store the whole editor workspace for the signed-in user."""

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Not signed in'}, status=401)
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            data = {}
        workspace, _ = Workspace.objects.get_or_create(user=request.user)
        workspace.data = data
        workspace.save()
        return JsonResponse({'ok': True})


class FilesListAPIView(View):
    """Return the signed-in user's saved workspace."""

    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Not signed in'}, status=401)
        workspace, _ = Workspace.objects.get_or_create(user=request.user)
        return JsonResponse(workspace.data)


class SuggestAPIView(View):
    """Public word-suggestion endpoint for the dictionary."""

    def get(self, request):
        text = request.GET.get('text', '')
        return JsonResponse(suggest(text))


class CheckAPIView(View):
    """Public spell-check endpoint for the dictionary."""

    def get(self, request):
        text = request.GET.get('text', '')
        return JsonResponse({'text': text, 'words': check(text)})


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