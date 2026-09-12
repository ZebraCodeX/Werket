"""Views for Werket."""
import json
from django.conf import settings
from django.http import HttpResponse, JsonResponse, Http404
from django.views import View
from django.views.generic import TemplateView, FormView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView, LogoutView, PasswordChangeView
from django.contrib.auth import login
from django.urls import reverse_lazy

from .forms import BootstrapAuthenticationForm, UserRegistrationForm, DocumentForm, UserPreferencesForm
from .models import Document, UserPreferences
from .api import check, suggest


class IndexView(LoginRequiredMixin, TemplateView):
    """Main editor page."""
    template_name = 'werket/index.html'
    login_url = 'login'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        prefs, _ = UserPreferences.objects.get_or_create(user=self.request.user)
        docs = Document.objects.filter(user=self.request.user)
        context['prefs'] = prefs
        context['documents'] = docs
        context['documents_json'] = json.dumps([{
            'id': d.id,
            'name': d.name,
            'folder': d.folder,
            'content': d.content,
            'html_content': d.html_content,
            'is_active': d.is_active,
        } for d in docs], ensure_ascii=False)
        context['prefs_json'] = json.dumps({
            'font_family': prefs.font_family,
            'font_size': prefs.font_size,
            'theme': prefs.theme,
            'show_inspector': prefs.show_inspector,
            'show_keyboard': prefs.show_keyboard,
            'phonetic_enabled': prefs.phonetic_enabled,
        }, ensure_ascii=False)
        return context


class CustomLoginView(LoginView):
    """Custom login view with styled form."""
    template_name = 'registration/login.html'
    form_class = BootstrapAuthenticationForm
    redirect_authenticated_user = True


class CustomLogoutView(LogoutView):
    """Custom logout view."""
    next_page = reverse_lazy('login')


class RegisterView(FormView):
    """User registration view."""
    template_name = 'registration/register.html'
    form_class = UserRegistrationForm
    success_url = reverse_lazy('index')

    def form_valid(self, form):
        user = form.save()
        login(self.request, user)
        UserPreferences.objects.get_or_create(user=user)
        return super().form_valid(form)


class CustomPasswordChangeView(LoginRequiredMixin, PasswordChangeView):
    """Custom password change view."""
    template_name = 'registration/password_change.html'
    success_url = reverse_lazy('password_change_done')


class SuggestAPIView(LoginRequiredMixin, View):
    """API endpoint for word suggestions."""

    def get(self, request):
        text = request.GET.get('text', '')
        data = suggest(text)
        return JsonResponse(data)


class CheckAPIView(LoginRequiredMixin, View):
    """API endpoint for spell checking."""

    def get(self, request):
        text = request.GET.get('text', '')
        data = {'text': text, 'words': check(text)}
        return JsonResponse(data)


class DocumentListView(LoginRequiredMixin, View):
    """API endpoint for listing user documents."""

    def get(self, request):
        docs = Document.objects.filter(user=request.user).values(
            'id', 'name', 'folder', 'content', 'html_content', 'is_active', 'updated_at'
        )
        return JsonResponse(list(docs), safe=False)


class DocumentCreateView(LoginRequiredMixin, View):
    """API endpoint for creating a new document."""

    def post(self, request):
        data = json.loads(request.body)
        doc = Document.objects.create(
            user=request.user,
            name=data.get('name', 'Untitled'),
            folder=data.get('folder', ''),
            content=data.get('content', ''),
            html_content=data.get('html_content', ''),
            is_active=data.get('is_active', False)
        )
        if doc.is_active:
            Document.objects.filter(user=request.user).exclude(pk=doc.pk).update(is_active=False)
        return JsonResponse({'id': doc.id, 'name': doc.name, 'folder': doc.folder})


class DocumentUpdateView(LoginRequiredMixin, View):
    """API endpoint for updating a document."""

    def post(self, request, pk):
        try:
            doc = Document.objects.get(pk=pk, user=request.user)
        except Document.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)

        data = json.loads(request.body)
        doc.name = data.get('name', doc.name)
        doc.folder = data.get('folder', doc.folder)
        doc.content = data.get('content', doc.content)
        doc.html_content = data.get('html_content', doc.html_content)
        if 'is_active' in data:
            if data.get('is_active'):
                Document.objects.filter(user=request.user).exclude(pk=doc.pk).update(is_active=False)
            doc.is_active = bool(data.get('is_active'))
        doc.save()
        return JsonResponse({'id': doc.id, 'name': doc.name})


class DocumentDeleteView(LoginRequiredMixin, View):
    """API endpoint for deleting a document."""

    def post(self, request, pk):
        try:
            doc = Document.objects.get(pk=pk, user=request.user)
            doc.delete()
            return JsonResponse({'success': True})
        except Document.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)


class UserPreferencesView(LoginRequiredMixin, View):
    """API endpoint for user preferences."""

    def get(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        return JsonResponse({
            'font_family': prefs.font_family,
            'font_size': prefs.font_size,
            'theme': prefs.theme,
            'show_inspector': prefs.show_inspector,
            'show_keyboard': prefs.show_keyboard,
            'phonetic_enabled': prefs.phonetic_enabled,
        })

    def post(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        data = json.loads(request.body)
        prefs.font_family = data.get('font_family', prefs.font_family)
        prefs.font_size = data.get('font_size', prefs.font_size)
        prefs.theme = data.get('theme', prefs.theme)
        prefs.show_inspector = data.get('show_inspector', prefs.show_inspector)
        prefs.show_keyboard = data.get('show_keyboard', prefs.show_keyboard)
        prefs.phonetic_enabled = data.get('phonetic_enabled', prefs.phonetic_enabled)
        prefs.save()
        return JsonResponse({'success': True})


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