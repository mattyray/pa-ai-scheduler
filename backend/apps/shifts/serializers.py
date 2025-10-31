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
            'approved_by', 'created_at', 'updated_at'
        ]
    
    def validate_schedule_period(self, value):
        """Ensure period is OPEN for new requests"""
        if self.instance is None:  # Only on creation
            if value.status != 'OPEN':
                raise serializers.ValidationError(
                    f'Cannot submit requests for {value.status} periods. Period must be OPEN.'
                )
        return value
    
    def validate(self, data):
        """Validate shift request rules"""
        # Get schedule period
        schedule_period = data.get('schedule_period', getattr(self.instance, 'schedule_period', None))
        date = data.get('date', getattr(self.instance, 'date', None))
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))
        requested_by = data.get('requested_by', getattr(self.instance, 'requested_by', None))
        
        # Validate start_time < end_time
        if start_time and end_time:
            if start_time >= end_time:
                raise serializers.ValidationError({
                    'end_time': 'End time must be after start time.'
                })
        
        # Validate date within period
        if schedule_period and date:
            if not (schedule_period.start_date <= date <= schedule_period.end_date):
                raise serializers.ValidationError({
                    'date': f'Date must be between {schedule_period.start_date} and {schedule_period.end_date}'
                })
        
        # Check for overlapping shifts (same PA, same time)
        if date and start_time and end_time and requested_by:
            overlapping = ShiftRequest.objects.filter(
                requested_by=requested_by,
                date=date,
                status__in=['PENDING', 'APPROVED']
            ).exclude(pk=self.instance.pk if self.instance else None)
            
            for shift in overlapping:
                # Check for time overlap
                if not (end_time <= shift.start_time or start_time >= shift.end_time):
                    raise serializers.ValidationError({
                        'time': f'You already have a shift from {shift.start_time} to {shift.end_time} on this date.'
                    })
        
        # Check for duplicate pending requests
        if self.instance is None and date and start_time and end_time and requested_by:
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
    
    def create(self, validated_data):
        """Create shift request with auto-calculated duration"""
        # Set requested_by to current user if not provided
        if 'requested_by' not in validated_data:
            validated_data['requested_by'] = self.context['request'].user
        
        return super().create(validated_data)


class ShiftRequestCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for PAs creating requests"""
    class Meta:
        model = ShiftRequest
        fields = ['schedule_period', 'date', 'start_time', 'end_time', 'notes']
    
    def validate_schedule_period(self, value):
        """Ensure period is OPEN"""
        if value.status != 'OPEN':
            raise serializers.ValidationError(
                f'Cannot submit requests for {value.status} periods.'
            )
        return value
    
    def validate(self, data):
        """Run same validations as main serializer"""
        serializer = ShiftRequestSerializer(data=data, context=self.context)
        serializer.is_valid(raise_exception=True)
        return data


class ShiftApprovalSerializer(serializers.Serializer):
    """Serializer for approving shifts"""
    admin_notes = serializers.CharField(required=False, allow_blank=True)
    override_overtime = serializers.BooleanField(default=False, required=False)


class ShiftRejectionSerializer(serializers.Serializer):
    """Serializer for rejecting shifts"""
    rejected_reason = serializers.CharField(required=True)