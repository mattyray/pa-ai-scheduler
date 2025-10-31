from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import SchedulePeriod
from .serializers import (
    SchedulePeriodSerializer,
    SchedulePeriodDetailSerializer,
    SchedulePeriodCreateUpdateSerializer
)


class IsAdminUser(permissions.BasePermission):
    """Custom permission: only admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'


class SchedulePeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Schedule Periods
    
    List: GET /api/schedule-periods/ (all users)
    Retrieve: GET /api/schedule-periods/{id}/ (all users)
    Create: POST /api/schedule-periods/ (admin only)
    Update: PUT/PATCH /api/schedule-periods/{id}/ (admin only)
    Delete: DELETE /api/schedule-periods/{id}/ (admin only)
    Finalize: POST /api/schedule-periods/{id}/finalize/ (admin only)
    """
    queryset = SchedulePeriod.objects.all().order_by('-start_date')
    
    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'retrieve':
            return SchedulePeriodDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SchedulePeriodCreateUpdateSerializer
        return SchedulePeriodSerializer
    
    def get_permissions(self):
        """Admin only for create/update/delete"""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'finalize']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Set created_by to current user"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """
        Finalize a schedule period (admin only)
        Validates that all critical times are covered before allowing finalization
        """
        period = self.get_object()
        
        if period.status == 'FINALIZED':
            return Response(
                {'error': 'This period is already finalized.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Validate critical time coverage (Task 6.4)
        # For now, just finalize
        period.status = 'FINALIZED'
        period.save()
        
        # TODO: Auto-reject all pending requests (Task 6.4)
        # TODO: Send finalized notification email to all PAs (Task 6.4)
        
        return Response({
            'message': 'Schedule period finalized successfully.',
            'period': SchedulePeriodSerializer(period).data
        }, status=status.HTTP_200_OK)