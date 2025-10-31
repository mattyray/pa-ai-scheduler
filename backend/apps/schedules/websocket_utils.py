from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.shifts.serializers import ShiftRequestSerializer
import logging

logger = logging.getLogger(__name__)


def broadcast_shift_event(event_type, shift, message=None, changes=None):
    """
    Broadcast shift events to WebSocket clients.
    
    Args:
        event_type: Type of event (requested, approved, rejected, updated, deleted)
        shift: ShiftRequest instance (or None for deleted)
        message: Optional custom message
        changes: Optional dict of changes (for updated events)
    """
    channel_layer = get_channel_layer()
    
    if shift and hasattr(shift, 'schedule_period'):
        period_id = shift.schedule_period.id
        room_group_name = f'schedule_{period_id}'
        
        # Prepare shift data
        if event_type != 'deleted':
            shift_data = ShiftRequestSerializer(shift).data
        else:
            shift_data = None
        
        # Prepare event data
        event_data = {
            'type': f'shift_{event_type}',  # Converts to shift_requested, shift_approved, etc.
            'message': message or f'Shift {event_type}'
        }
        
        if shift_data:
            event_data['shift'] = shift_data
        
        if event_type == 'deleted':
            event_data['shift_id'] = shift.id if shift else None
        
        if changes:
            event_data['changes'] = changes
        
        # Broadcast to group
        try:
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                event_data
            )
            logger.info(f'WebSocket broadcast: {event_type} for shift {shift.id if shift else "N/A"} in period {period_id}')
        except Exception as e:
            logger.error(f'Failed to broadcast WebSocket event: {e}')


def broadcast_coverage_alert(date, coverage, period_id, message=None):
    """
    Broadcast coverage alert to WebSocket clients.
    
    Args:
        date: Date of coverage change
        coverage: Coverage data dict
        period_id: Schedule period ID
        message: Optional custom message
    """
    channel_layer = get_channel_layer()
    room_group_name = f'schedule_{period_id}'
    
    event_data = {
        'type': 'coverage_alert',
        'date': str(date),
        'coverage': coverage,
        'message': message or 'Coverage status updated'
    }
    
    try:
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            event_data
        )
        logger.info(f'WebSocket broadcast: coverage alert for {date} in period {period_id}')
    except Exception as e:
        logger.error(f'Failed to broadcast coverage alert: {e}')


def broadcast_period_finalized(period, message=None):
    """
    Broadcast period finalization to WebSocket clients.
    
    Args:
        period: SchedulePeriod instance
        message: Optional custom message
    """
    channel_layer = get_channel_layer()
    room_group_name = f'schedule_{period.id}'
    
    from apps.schedules.serializers import SchedulePeriodSerializer
    
    event_data = {
        'type': 'period_finalized',
        'period': SchedulePeriodSerializer(period).data,
        'message': message or f'{period.name} has been finalized'
    }
    
    try:
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            event_data
        )
        logger.info(f'WebSocket broadcast: period {period.id} finalized')
    except Exception as e:
        logger.error(f'Failed to broadcast period finalized: {e}')