from django.contrib import admin
from .models import ChatMessage


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'message_preview', 'created_at', 'is_edited')
    list_filter = ('created_at', 'is_edited', 'user')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'message')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'edited_at')
    
    def message_preview(self, obj):
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_preview.short_description = 'Message'