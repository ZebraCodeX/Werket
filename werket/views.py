"""Views for Werket."""
from django.contrib.auth import login, logout
from django.http import Http404, HttpResponse
from django.shortcuts import render, redirect
from django.views import View
from django.conf import settings

from .forms import LoginForm, SignupForm


class PwaAssetView(View):
    """Serve PWA static files at their canonical root URLs.

    The manifest, service worker, robots.txt, sitemap.xml, and privacy page
    must live at the root URLs; Django otherwise only exposes them under
    /static/. The built files end up in STATIC_ROOT after the frontend build.
    """
    asset_name = None
    content_type = 'text/plain'

    def get(self, request):
        for directory in settings.STATICFILES_DIRS + [settings.STATIC_ROOT]:
            candidate = directory / self.asset_name
            if candidate.is_file():
                try:
                    body = candidate.read_bytes()
                except OSError:
                    continue
                return HttpResponse(body, content_type=self.content_type)
        raise Http404('not found')


def login_view(request):
    """Render login page and handle login form submission."""
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            login(request, form.user)
            next_url = request.POST.get('next') or 'index'
            return redirect(next_url)
    else:
        form = LoginForm()
    return render(request, 'registration/login.html', {'form': form})


def signup_view(request):
    """Render signup page and handle registration form submission."""
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('index')
    else:
        form = SignupForm()
    return render(request, 'registration/signup.html', {'form': form})


def logout_view(request):
    """Handle logout."""
    logout(request)
    return redirect('index')