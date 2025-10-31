from rest_framework import serializers
from .models import SchedulePeriod
from apps.users.serializers import UserSerializer


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
        """Return all shifts (we'll import ShiftSerializer later)"""
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