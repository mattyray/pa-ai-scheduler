from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import ShiftRequest
from .serializers import (
    ShiftRequestSerializer,
    ShiftRequestCreateSerializer,
    ShiftApprovalSerializer,
    ShiftRejectionSerializer
)


class IsAdminUser(permissions.BasePermission):
    """Only admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'


class IsPAUser(permissions.BasePermission):
    """Only PA users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'PA'


class IsOwnerOrAdmin(permissions.BasePermission):
    """Owner of the shift or admin"""
    def has_object_permission(self, request, view, obj):
        return (
            request.user.role == 'ADMIN' or 
            obj.requested_by == request.user
        )


class ShiftRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Shift Requests
    
    List: GET /api/shifts/ (filtered by role)
    Create: POST /api/shifts/ (PA creates request, Admin creates direct)
    Retrieve: GET /api/shifts/{id}/
    Update: PATCH /api/shifts/{id}/ (own pending requests only)
    Delete: DELETE /api/shifts/{id}/ (cancel own pending requests)
    Approve: POST /api/shifts/{id}/approve/ (admin only)
    Reject: POST /api/shifts/{id}/reject/ (admin only)
    """
    queryset = ShiftRequest.objects.all().select_related(
        'schedule_period', 'requested_by', 'approved_by'
    ).order_by('-created_at')
    serializer_class = ShiftRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset based on user role"""
        user = self.request.user
        queryset = super().get_queryset()
        
        # PAs only see their own shifts
        if user.role == 'PA':
            queryset = queryset.filter(requested_by=user)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by schedule period if provided
        period_id = self.request.query_params.get('period')
        if period_id:
            queryset = queryset.filter(schedule_period_id=period_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        return queryset
    
    def get_serializer_class(self):
        """Use simplified serializer for PA creation"""
        if self.action == 'create' and self.request.user.role == 'PA':
            return ShiftRequestCreateSerializer
        return ShiftRequestSerializer
    
    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['approve', 'reject']:
            return [IsAdminUser()]
        elif self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Set requested_by to current user"""
        user = self.request.user
        
        # Admin can create direct approved shifts
        if user.role == 'ADMIN':
            admin_direct = self.request.data.get('admin_direct', False)
            if admin_direct:
                serializer.save(
                    status='APPROVED',
                    approved_by=user,
                    approved_at=timezone.now()
                )
                # TODO: Trigger coverage updates
                return
        
        # Regular PA request
        serializer.save(requested_by=user, status='PENDING')
        # TODO: Send notification email to admin (Task 3.6)
    
    def update(self, request, *args, **kwargs):
        """Only allow updating pending requests"""
        instance = self.get_object()
        
        # PAs can only edit their own pending requests
        if request.user.role == 'PA':
            if instance.requested_by != request.user:
                return Response(
                    {'error': 'You can only edit your own requests.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if instance.status != 'PENDING':
                return Response(
                    {'error': 'You can only edit pending requests.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Allow canceling pending requests or admin deletion"""
        instance = self.get_object()
        
        # PAs can only cancel their own pending requests
        if request.user.role == 'PA':
            if instance.requested_by != request.user:
                return Response(
                    {'error': 'You can only cancel your own requests.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if instance.status != 'PENDING':
                return Response(
                    {'error': 'You can only cancel pending requests.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            instance.status = 'CANCELLED'
            instance.save()
            return Response({'message': 'Request cancelled successfully.'})
        
        # Admin can delete any shift
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending requests (admin only)"""
        if request.user.role != 'ADMIN':
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        pending_requests = self.get_queryset().filter(status='PENDING')
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_schedule(self, request):
        """Get my approved shifts (PA only)"""
        if request.user.role != 'PA':
            return Response(
                {'error': 'PA access only.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        approved_shifts = self.get_queryset().filter(
            status='APPROVED',
            requested_by=request.user
        ).order_by('date', 'start_time')
        
        serializer = self.get_serializer(approved_shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve a shift request (admin only)
        Validates no conflicts and updates coverage
        """
        shift = self.get_object()
        
        if shift.status != 'PENDING':
            return Response(
                {'error': f'Cannot approve {shift.status} request.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ShiftApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check for conflicts (same time, different PA)
        conflicting_shifts = ShiftRequest.objects.filter(
            date=shift.date,
            status='APPROVED'
        ).exclude(pk=shift.pk)
        
        for other_shift in conflicting_shifts:
            # Check time overlap
            if not (shift.end_time <= other_shift.start_time or 
                    shift.start_time >= other_shift.end_time):
                return Response({
                    'error': f'Conflict detected: {other_shift.requested_by.get_full_name()} '
                             f'already has a shift from {other_shift.start_time} to {other_shift.end_time}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # TODO: Check weekly hours and show warning (Task 3.5)
        # TODO: Update coverage models (Task 3.5)
        
        # Approve the shift
        shift.status = 'APPROVED'
        shift.approved_by = request.user
        shift.approved_at = timezone.now()
        if serializer.validated_data.get('admin_notes'):
            shift.admin_notes = serializer.validated_data['admin_notes']
        shift.save()
        
        # TODO: Send approval email (Task 3.6)
        # TODO: Trigger WebSocket event (Phase 5)
        
        return Response({
            'message': 'Shift approved successfully.',
            'shift': ShiftRequestSerializer(shift).data
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a shift request (admin only)"""
        shift = self.get_object()
        
        if shift.status != 'PENDING':
            return Response(
                {'error': f'Cannot reject {shift.status} request.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ShiftRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Reject the shift
        shift.status = 'REJECTED'
        shift.rejected_reason = serializer.validated_data['rejected_reason']
        shift.save()
        
        # TODO: Send rejection email (Task 3.6)
        # TODO: Trigger WebSocket event (Phase 5)
        
        return Response({
            'message': 'Shift rejected.',
            'shift': ShiftRequestSerializer(shift).data
        })