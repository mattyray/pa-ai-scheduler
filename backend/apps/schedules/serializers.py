from rest_framework import serializers
from .models import SchedulePeriod
from apps.shifts.models import ShiftRequest
from apps.users.serializers import UserSerializer
from datetime import datetime, timedelta


class SchedulePeriodSerializer(serializers.ModelSerializer):
    """Basic serializer for listing schedule periods"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    shift_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SchedulePeriod
        fields = [
            'id', 'name', 'start_date', 'end_date', 'status',
            'created_by', 'created_by_name', 'shift_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_shift_count(self, obj):
        """Count total shifts in this period"""
        return obj.shiftrequest_set.count()
    
    def validate(self, data):
        """Validate that end_date is after start_date"""
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date.'
                })
        return data


class SchedulePeriodDetailSerializer(SchedulePeriodSerializer):
    """Detailed serializer including all shifts"""
    shifts = serializers.SerializerMethodField()
    coverage_summary = serializers.SerializerMethodField()
    
    class Meta(SchedulePeriodSerializer.Meta):
        fields = SchedulePeriodSerializer.Meta.fields + ['shifts', 'coverage_summary']
    
    def get_shifts(self, obj):
        """Return all shifts"""
        from apps.shifts.serializers import ShiftRequestSerializer
        shifts = obj.shiftrequest_set.all().order_by('date', 'start_time')
        return ShiftRequestSerializer(shifts, many=True).data
    
    def get_coverage_summary(self, obj):
        """Summary of coverage for this period"""
        total_shifts = obj.shiftrequest_set.filter(status='APPROVED').count()
        pending_requests = obj.shiftrequest_set.filter(status='PENDING').count()
        
        return {
            'total_approved_shifts': total_shifts,
            'pending_requests': pending_requests,
            'status': obj.status
        }


class SchedulePeriodCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating periods"""
    class Meta:
        model = SchedulePeriod
        fields = ['name', 'start_date', 'end_date', 'status']
    
    def validate(self, data):
        """Validate dates"""
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date.'
                })
        return data


class CalendarShiftSerializer(serializers.ModelSerializer):
    """Simplified shift serializer for calendar views"""
    pa_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    pa_id = serializers.IntegerField(source='requested_by.id', read_only=True)
    
    class Meta:
        model = ShiftRequest
        fields = [
            'id', 'pa_id', 'pa_name', 'date', 
            'start_time', 'end_time', 'duration_hours',
            'notes', 'status'
        ]


class DayScheduleSerializer(serializers.Serializer):
    """Serializer for a single day's schedule"""
    date = serializers.DateField()
    day_name = serializers.CharField()
    shifts = CalendarShiftSerializer(many=True)
    coverage = serializers.DictField()
    total_hours = serializers.DecimalField(max_digits=5, decimal_places=2)


class WeekScheduleSerializer(serializers.Serializer):
    """Serializer for a week's schedule"""
    week_start = serializers.DateField()
    week_end = serializers.DateField()
    week_number = serializers.IntegerField()
    days = DayScheduleSerializer(many=True)


class MonthScheduleSerializer(serializers.Serializer):
    """Serializer for a month's schedule"""
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    month_name = serializers.CharField()
    weeks = WeekScheduleSerializer(many=True)
    total_shifts = serializers.IntegerField()
    coverage_stats = serializers.DictField()