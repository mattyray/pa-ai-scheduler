from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import ShiftRequest, ShiftSuggestion
from .serializers import (
    ShiftRequestSerializer, 
    ShiftRequestCreateSerializer,
    ShiftSuggestionSerializer, 
    ShiftSuggestionCreateSerializer,
    ShiftSuggestionAcceptSerializer, 
    ShiftSuggestionDeclineSerializer
)
from .tasks import (
    send_new_request_email, 
    send_shift_approved_email, 
    send_shift_rejected_email,
    send_shift_suggestion_email, 
    notify_admin_suggestion_accepted, 
    notify_admin_suggestion_declined
)


class ShiftRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return ShiftRequest.objects.all()
        return ShiftRequest.objects.filter(requested_by=user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShiftRequestCreateSerializer
        return ShiftRequestSerializer
    
    def perform_create(self, serializer):
        shift_request = serializer.save(requested_by=self.request.user)
        send_new_request_email.delay(shift_request.id)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        shift_request = self.get_object()
        if shift_request.status != 'PENDING':
            return Response({'error': 'Can only approve pending requests'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift_request.status = 'APPROVED'
        shift_request.approved_by = request.user
        shift_request.approved_at = timezone.now()
        shift_request.admin_notes = request.data.get('admin_notes', '')
        shift_request.save()
        
        send_shift_approved_email.delay(shift_request.id)
        
        return Response(ShiftRequestSerializer(shift_request).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        shift_request = self.get_object()
        if shift_request.status != 'PENDING':
            return Response({'error': 'Can only reject pending requests'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift_request.status = 'REJECTED'
        shift_request.rejected_reason = request.data.get('rejected_reason', '')
        shift_request.save()
        
        send_shift_rejected_email.delay(shift_request.id)
        
        return Response(ShiftRequestSerializer(shift_request).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        shift_request = self.get_object()
        
        if shift_request.requested_by != request.user:
            return Response({'error': 'Can only cancel own requests'}, status=status.HTTP_403_FORBIDDEN)
        
        if shift_request.status != 'PENDING':
            return Response({'error': 'Can only cancel pending requests'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift_request.status = 'CANCELLED'
        shift_request.save()
        
        return Response(ShiftRequestSerializer(shift_request).data)


class ShiftSuggestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return ShiftSuggestion.objects.filter(suggested_by=user)
        return ShiftSuggestion.objects.filter(suggested_to=user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ShiftSuggestionCreateSerializer
        elif self.action == 'accept':
            return ShiftSuggestionAcceptSerializer
        elif self.action == 'decline':
            return ShiftSuggestionDeclineSerializer
        return ShiftSuggestionSerializer
    
    def create(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        suggestion = serializer.save(suggested_by=request.user)
        send_shift_suggestion_email.delay(suggestion.id)
        
        return Response(ShiftSuggestionSerializer(suggestion).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        suggestion = self.get_object()
        
        if suggestion.suggested_to != request.user:
            return Response({'error': 'Can only accept own suggestions'}, status=status.HTTP_403_FORBIDDEN)
        
        if suggestion.status != 'PENDING':
            return Response({'error': 'Suggestion already responded to'}, status=status.HTTP_400_BAD_REQUEST)
        
        shift_request = ShiftRequest.objects.create(
            schedule_period=suggestion.schedule_period,
            requested_by=request.user,
            date=suggestion.date,
            start_time=suggestion.start_time,
            end_time=suggestion.end_time,
            notes=f"Accepted suggestion from {suggestion.suggested_by.get_full_name()}"
        )
        
        suggestion.status = 'ACCEPTED'
        suggestion.responded_at = timezone.now()
        suggestion.related_shift_request = shift_request
        suggestion.save()
        
        notify_admin_suggestion_accepted.delay(suggestion.id)
        
        return Response(ShiftSuggestionSerializer(suggestion).data)
    
    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        suggestion = self.get_object()
        
        if suggestion.suggested_to != request.user:
            return Response({'error': 'Can only decline own suggestions'}, status=status.HTTP_403_FORBIDDEN)
        
        if suggestion.status != 'PENDING':
            return Response({'error': 'Suggestion already responded to'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ShiftSuggestionDeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        suggestion.status = 'DECLINED'
        suggestion.responded_at = timezone.now()
        suggestion.decline_reason = serializer.validated_data.get('decline_reason', '')
        suggestion.save()
        
        notify_admin_suggestion_declined.delay(suggestion.id)
        
        return Response(ShiftSuggestionSerializer(suggestion).data)
