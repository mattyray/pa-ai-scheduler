from rest_framework import serializers
from django.utils import timezone
from datetime import datetime, timedelta
from .models import ShiftRequest, ShiftSuggestion
from apps.schedules.models import SchedulePeriod
from apps.users.serializers import UserSerializer


class ShiftRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    schedule_period_name = serializers.CharField(source='schedule_period.name', read_only=True)
    
    class Meta:
        model = ShiftRequest
        fields = [
            'id', 'schedule_period', 'schedule_period_name',
            'requested_by', 'requested_by_name',
            'date', 'start_time', 'end_time', 'duration_hours',
            'status', 'notes', 'admin_notes', 'rejected_reason',
            'created_at', 'updated_at', 'approved_at', 
            'approved_by', 'approved_by_name'
        ]
        read_only_fields = [
            'id', 'duration_hours', 'status', 'approved_at', 
            'approved_by', 'created_at', 'updated_at', 'requested_by'
        ]


class ShiftRequestCreateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = ShiftRequest
        fields = ['schedule_period', 'date', 'start_time', 'end_time', 'notes']
    
    def validate_schedule_period(self, value):
        if value.status != 'OPEN':
            raise serializers.ValidationError(
                f'Cannot submit requests for {value.status} periods. Period must be OPEN.'
            )
        return value
    
    def validate(self, data):
        schedule_period = data.get('schedule_period')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('User context required')
        
        requested_by = request.user
        
        if schedule_period and date:
            if not (schedule_period.start_date <= date <= schedule_period.end_date):
                raise serializers.ValidationError(
                    f'Date must be within period range: {schedule_period.start_date} to {schedule_period.end_date}'
                )
        
        if date and date < timezone.now().date():
            raise serializers.ValidationError('Cannot request shifts for past dates')
        
        if schedule_period and date and start_time and end_time:
            from apps.schedules.utils import check_shift_conflicts
            conflicts = check_shift_conflicts(
                schedule_period=schedule_period,
                date=date,
                start_time=start_time,
                end_time=end_time,
                exclude_request_id=None
            )
            if conflicts:
                raise serializers.ValidationError(
                    'This shift conflicts with existing approved shifts'
                )
        
        return data


class ShiftSuggestionSerializer(serializers.ModelSerializer):
    suggested_by_name = serializers.CharField(source='suggested_by.get_full_name', read_only=True)
    suggested_to_name = serializers.CharField(source='suggested_to.get_full_name', read_only=True)
    schedule_period_name = serializers.CharField(source='schedule_period.name', read_only=True)
    
    class Meta:
        model = ShiftSuggestion
        fields = [
            'id', 'suggested_by', 'suggested_by_name',
            'suggested_to', 'suggested_to_name',
            'schedule_period', 'schedule_period_name',
            'date', 'start_time', 'end_time', 'duration_hours',
            'message', 'decline_reason', 'status',
            'related_shift_request', 'created_at', 'responded_at'
        ]
        read_only_fields = [
            'id', 'suggested_by', 'duration_hours', 'status',
            'related_shift_request', 'created_at', 'responded_at'
        ]


class ShiftSuggestionCreateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = ShiftSuggestion
        fields = ['suggested_to', 'schedule_period', 'date', 'start_time', 'end_time', 'message']
    
    def validate_schedule_period(self, value):
        if value.status not in ['OPEN', 'LOCKED']:
            raise serializers.ValidationError('Period must be OPEN or LOCKED')
        return value
    
    def validate_suggested_to(self, value):
        if value.role != 'PA':
            raise serializers.ValidationError('Can only suggest shifts to PAs')
        return value
    
    def validate(self, data):
        date = data.get('date')
        schedule_period = data.get('schedule_period')
        
        if schedule_period and date:
            if not (schedule_period.start_date <= date <= schedule_period.end_date):
                raise serializers.ValidationError(
                    f'Date must be within period range'
                )
        
        if date and date < timezone.now().date():
            raise serializers.ValidationError('Cannot suggest shifts for past dates')
        
        return data


class ShiftSuggestionAcceptSerializer(serializers.Serializer):
    pass


class ShiftSuggestionDeclineSerializer(serializers.Serializer):
    decline_reason = serializers.CharField(required=False, allow_blank=True)
