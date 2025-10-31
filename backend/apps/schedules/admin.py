from django.contrib import admin
from .models import SchedulePeriod


@admin.register(SchedulePeriod)
class SchedulePeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Period Information', {
            'fields': ('name', 'start_date', 'end_date', 'status')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )