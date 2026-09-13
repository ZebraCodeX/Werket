"""Django auth forms for the standalone login/signup pages."""
from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import User


class LoginForm(forms.Form):
    """Sign in with email + password (accounts use email as username)."""
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-input',
            'placeholder': 'you@example.com',
            'autocomplete': 'email',
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-input',
            'placeholder': 'Your password',
            'autocomplete': 'current-password',
        })
    )

    def clean(self):
        cleaned = super().clean()
        email = cleaned.get('email', '').strip()
        password = cleaned.get('password', '')
        username = User.objects.filter(email__iexact=email).values_list('username', flat=True).first()
        user = authenticate(username=username or email, password=password)
        if user is None:
            raise forms.ValidationError('Invalid email or password.')
        self.user = user
        return cleaned


class SignupForm(forms.ModelForm):
    """Create an account. Email becomes the username."""
    email = forms.EmailField(widget=forms.EmailInput(attrs={
        'class': 'form-input',
        'placeholder': 'you@example.com',
        'autocomplete': 'email',
    }))
    name = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-input',
        'placeholder': 'Your name (optional)',
        'autocomplete': 'name',
    }))
    password = forms.CharField(widget=forms.PasswordInput(attrs={
        'class': 'form-input',
        'placeholder': 'Create a password',
        'autocomplete': 'new-password',
    }))

    class Meta:
        model = User
        fields = ['email', 'name', 'password']

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('An account with that email already exists.')
        return email

    def clean_password(self):
        password = self.cleaned_data['password']
        if len(password) < 4:
            raise forms.ValidationError('Password must be at least 4 characters.')
        return password

    def save(self, commit=True):
        user = User.objects.create_user(
            username=self.cleaned_data['email'],
            email=self.cleaned_data['email'],
            password=self.cleaned_data['password'],
        )
        if self.cleaned_data.get('name'):
            user.first_name = self.cleaned_data['name']
            user.save(update_fields=['first_name'])
        return user