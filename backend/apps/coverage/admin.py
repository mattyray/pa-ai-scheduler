from django.contrib import admin
from .models import CriticalTimeCoverage, WeeklyCoverage


@admin.register(CriticalTimeCoverage)
class CriticalTimeCoverageAdmin(admin.ModelAdmin):
    list_display = ['date', 'morning_covered', 'evening_covered', 'coverage_status', 'updated_at']
    list_filter = ['morning_covered', 'evening_covered', 'date']
    search_fields = ['date']
    readonly_fields = ['updated_at']
    date_hierarchy = 'date'
    
    fieldsets = (
        ('Date', {
            'fields': ('date',)
        }),
        ('Coverage Status', {
            'fields': ('morning_covered', 'evening_covered', 'morning_shift', 'evening_shift')
        }),
        ('Metadata', {
            'fields': ('updated_at',),
            'classes': ('collapse',)
        }),
    )
    
    def coverage_status(self, obj):
        """Display coverage status with icon"""
        if obj.is_fully_covered:
            return '✅ Complete'
        elif obj.morning_covered or obj.evening_covered:
            return '⚠️ Partial'
        return '❌ None'
    coverage_status.short_description = 'Coverage Status'


@admin.register(WeeklyCoverage)
class WeeklyCoverageAdmin(admin.ModelAdmin):
    list_display = ['pa', 'week_start_date', 'schedule_period', 'total_hours', 'exceeds_limit', 'updated_at']
    list_filter = ['exceeds_limit', 'schedule_period', 'week_start_date']
    search_fields = ['pa__email', 'pa__first_name', 'pa__last_name']
    readonly_fields = ['updated_at']
    date_hierarchy = 'week_start_date'
    
    fieldsets = (
        ('Week Information', {
            'fields': ('schedule_period', 'pa', 'week_start_date')
        }),
        ('Hours', {
            'fields': ('total_hours', 'exceeds_limit')
        }),
        ('Metadata', {
            'fields': ('updated_at',),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'schedule_period', 'pa'
        )