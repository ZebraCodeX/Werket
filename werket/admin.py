"""Admin configuration for Werket."""
from django.contrib import admin

from .models import Document, UserPreferences


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('name', 'folder', 'user', 'is_active', 'updated_at')
    list_filter = ('is_active', 'folder')
    search_fields = ('name', 'folder', 'content')
    ordering = ('-updated_at',)


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ('user', 'font_family', 'font_size', 'theme', 'phonetic_enabled')
    search_fields = ('user__username',)