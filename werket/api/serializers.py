"""DRF Serializers for Werket API."""
from rest_framework import serializers
from django.contrib.auth.models import User
from ..models import Workspace


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name']
        read_only_fields = ['id', 'username']


class WorkspaceSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Workspace
        fields = ['id', 'user', 'data', 'updated_at']
        read_only_fields = ['id', 'user', 'updated_at']


class WorkspaceDataSerializer(serializers.Serializer):
    """Serializer for the workspace JSON data."""
    projectName = serializers.CharField(default='My documents', required=False)
    files = serializers.ListField(child=serializers.DictField(), default=list, required=False)
    openIds = serializers.ListField(child=serializers.CharField(), default=list, required=False)
    activeId = serializers.CharField(required=False, allow_null=True)
    font = serializers.CharField(default='Noto Sans Ethiopic', required=False)
    size = serializers.IntegerField(default=18, required=False)
    align = serializers.ChoiceField(
        choices=['left', 'center', 'right', 'justify'],
        default='left',
        required=False
    )
    lang = serializers.ChoiceField(choices=['am', 'en'], default='am', required=False)


class SuggestionSerializer(serializers.Serializer):
    words = serializers.ListField(child=serializers.CharField())
    next = serializers.ListField(child=serializers.CharField())
    dictionary_size = serializers.IntegerField()


class CheckWordSerializer(serializers.Serializer):
    word = serializers.CharField()
    start = serializers.IntegerField()
    end = serializers.IntegerField()
    known = serializers.BooleanField()
    suggestions = serializers.ListField(child=serializers.DictField())


class CheckSerializer(serializers.Serializer):
    text = serializers.CharField()
    words = CheckWordSerializer(many=True)


class AiGenerateSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=500)
    lang = serializers.ChoiceField(choices=['am', 'en'], default='am')
    type = serializers.ChoiceField(
        choices=['summary', 'story', 'essay', 'outline'],
        default='summary'
    )


class AiGenerateResponseSerializer(serializers.Serializer):
    content = serializers.CharField()
    topic = serializers.CharField()
    lang = serializers.CharField()
    type = serializers.CharField()
    method = serializers.CharField()