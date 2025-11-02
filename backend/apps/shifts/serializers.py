from rest_framework import serializers
from django.utils import timezone
from datetime import datetime, timedelta
from .models import ShiftRequest
from apps.schedules.models import SchedulePeriod
from apps.users.serializers import UserSerializer


class ShiftRequestSerializer(serializers.ModelSerializer):
    """Main serializer for shift requests"""
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
    """Simplified serializer for creating shift requests"""
    
    class Meta:
        model = ShiftRequest
        fields = ['schedule_period', 'date', 'start_time', 'end_time', 'notes']
    
    def validate_schedule_period(self, value):
        """Ensure period is OPEN"""
        if value.status != 'OPEN':
            raise serializers.ValidationError(
                f'Cannot submit requests for {value.status} periods. Period must be OPEN.'
            )
        return value
    
    def validate(self, data):
        """Validate shift request rules"""
        schedule_period = data.get('schedule_period')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # Get requested_by from context (set by view)
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('User context required')
        
        requested_by = request.user
        
        # REMOVED: Don't validate start_time < end_time here!
        # The model handles overnight shifts correctly by adding 24 hours
        # So we allow end_time to be "earlier" than start_time for overnight shifts
        
        # Validate date within period
        if schedule_period and date:
            if not (schedule_period.start_date <= date <= schedule_period.end_date):
                raise serializers.ValidationError({
                    'date': f'Date must be between {schedule_period.start_date} and {schedule_period.end_date}'
                })
        
        # Check for overlapping shifts (same PA, same time)
        if date and start_time and end_time:
            overlapping = ShiftRequest.objects.filter(
                requested_by=requested_by,
                date=date,
                status__in=['PENDING', 'APPROVED']
            )
            
            for shift in overlapping:
                # Check if times overlap
                # For overnight shifts, we need to be more careful
                if not (end_time <= shift.start_time or start_time >= shift.end_time):
                    raise serializers.ValidationError({
                        'time': f'You already have a shift from {shift.start_time} to {shift.end_time} on this date.'
                    })
        
        # Check for duplicate pending requests
        if date and start_time and end_time:
            duplicate = ShiftRequest.objects.filter(
                requested_by=requested_by,
                date=date,
                start_time=start_time,
                end_time=end_time,
                status='PENDING'
            ).exists()
            
            if duplicate:
                raise serializers.ValidationError(
                    'You already have a pending request for this exact shift.'
                )
        
        return data


class ShiftApprovalSerializer(serializers.Serializer):
    """Serializer for approving shifts"""
    admin_notes = serializers.CharField(required=False, allow_blank=True)
    override_overtime = serializers.BooleanField(default=False, required=False)


class ShiftRejectionSerializer(serializers.Serializer):
    """Serializer for rejecting shifts"""
    rejected_reason = serializers.CharField(required=True)
