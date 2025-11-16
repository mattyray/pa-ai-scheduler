from rest_framework import serializers
from .models import ChatMessage
from apps.users.serializers import UserSerializer


class ChatMessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'user', 'message', 'created_at', 'is_edited', 'edited_at']
        read_only_fields = ['id', 'user', 'created_at', 'is_edited', 'edited_at']