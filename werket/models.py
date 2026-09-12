"""Models for Werket."""
from django.db import models
from django.contrib.auth.models import User


class Workspace(models.Model):
    """A user's cloud-synced editor workspace.

    The editor persists its whole state (files, open tabs, active file,
    project name, fonts, alignment, language) as a single JSON blob, so we
    store that blob verbatim to round-trip the client contract exactly.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='workspace')
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.username} workspace'