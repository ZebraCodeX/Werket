"""Admin configuration for Werket."""
from django.contrib import admin

from .models import Workspace


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('user', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('updated_at',)