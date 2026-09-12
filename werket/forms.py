"""Forms for Werket."""
from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from .models import Document, UserPreferences


class BootstrapAuthenticationForm(AuthenticationForm):
    """Login form with Bootstrap styling."""
    username = forms.CharField(
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Username'})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Password'})
    )


class UserRegistrationForm(UserCreationForm):
    """User registration form with email."""
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Email'})
    )
    username = forms.CharField(
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Username'})
    )
    password1 = forms.CharField(
        label='Password',
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Password'})
    )
    password2 = forms.CharField(
        label='Confirm Password',
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Confirm Password'})
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        if commit:
            user.save()
        return user


class DocumentForm(forms.ModelForm):
    """Form for creating/editing documents."""
    class Meta:
        model = Document
        fields = ['name', 'folder', 'content', 'html_content']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'folder': forms.TextInput(attrs={'class': 'form-control'}),
            'content': forms.Textarea(attrs={'class': 'form-control', 'rows': 10}),
            'html_content': forms.Textarea(attrs={'class': 'form-control', 'rows': 10, 'hidden': True}),
        }


class UserPreferencesForm(forms.ModelForm):
    """Form for user preferences."""
    class Meta:
        model = UserPreferences
        fields = ['font_family', 'font_size', 'theme', 'show_inspector', 'show_keyboard', 'phonetic_enabled']
        widgets = {
            'font_family': forms.Select(attrs={'class': 'form-select'}),
            'font_size': forms.NumberInput(attrs={'class': 'form-control', 'min': 12, 'max': 48}),
            'theme': forms.Select(attrs={'class': 'form-select'}),
            'show_inspector': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'show_keyboard': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'phonetic_enabled': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }