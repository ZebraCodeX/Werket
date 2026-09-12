"""Models for Werket."""
from django.db import models
from django.contrib.auth.models import User


class Document(models.Model):
    """User document model."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=255)
    folder = models.CharField(max_length=255, blank=True, default='')
    content = models.TextField(blank=True, default='')
    html_content = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        unique_together = ['user', 'name', 'folder']

    def __str__(self):
        return f'{self.user.username}/{self.folder}/{self.name}'


class UserPreferences(models.Model):
    """User preferences for the editor."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    font_family = models.CharField(max_length=100, default='Noto Sans Ethiopic')
    font_size = models.PositiveIntegerField(default=18)
    theme = models.CharField(max_length=20, choices=[('light', 'Light'), ('dark', 'Dark')], default='light')
    show_inspector = models.BooleanField(default=False)
    show_keyboard = models.BooleanField(default=False)
    phonetic_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.username} preferences'