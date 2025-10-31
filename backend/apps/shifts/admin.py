from django.contrib import admin
from .models import ShiftRequest


@admin.register(ShiftRequest)
class ShiftRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'date', 'start_time', 'end_time', 'requested_by',
        'status', 'duration_hours', 'schedule_period', 'created_at'
    ]
    list_filter = ['status', 'date', 'schedule_period']
    search_fields = ['requested_by__email', 'requested_by__first_name', 'requested_by__last_name']
    readonly_fields = ['duration_hours', 'created_at', 'updated_at', 'approved_at']
    
    fieldsets = (
        ('Shift Details', {
            'fields': ('schedule_period', 'requested_by', 'date', 'start_time', 'end_time', 'duration_hours')
        }),
        ('Status', {
            'fields': ('status', 'approved_by', 'approved_at')
        }),
        ('Notes', {
            'fields': ('notes', 'admin_notes', 'rejected_reason')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'schedule_period', 'requested_by', 'approved_by'
        )