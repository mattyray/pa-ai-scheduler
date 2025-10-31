from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from .models import ShiftRequest
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_shift_approved_email(self, shift_id):
    """
    Send email notification when a shift is approved.
    Retries up to 3 times on failure.
    """
    try:
        shift = ShiftRequest.objects.select_related(
            'requested_by', 'approved_by', 'schedule_period'
        ).get(id=shift_id)
        
        pa = shift.requested_by
        
        # Context for email templates
        context = {
            'pa_name': pa.get_full_name(),
            'admin_name': shift.approved_by.get_full_name() if shift.approved_by else 'Admin',
            'shift_date': shift.date.strftime('%A, %B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'duration': shift.duration_hours,
            'period_name': shift.schedule_period.name,
            'admin_notes': shift.admin_notes,
            'frontend_url': settings.FRONTEND_URL,
        }
        
        # Render HTML and text versions
        html_message = render_to_string('emails/shift_approved.html', context)
        text_message = render_to_string('emails/shift_approved.txt', context)
        
        # Send email
        send_mail(
            subject=f'✅ Shift Approved: {shift.date.strftime("%b %d, %Y")}',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[pa.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'Shift approved email sent to {pa.email} for shift {shift_id}')
        return f'Email sent to {pa.email}'
        
    except ShiftRequest.DoesNotExist:
        logger.error(f'Shift {shift_id} not found')
        return f'Shift {shift_id} not found'
    
    except Exception as e:
        logger.error(f'Failed to send shift approved email: {e}')
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def send_shift_rejected_email(self, shift_id):
    """
    Send email notification when a shift is rejected.
    """
    try:
        shift = ShiftRequest.objects.select_related(
            'requested_by', 'schedule_period'
        ).get(id=shift_id)
        
        pa = shift.requested_by
        
        # Context for email templates
        context = {
            'pa_name': pa.get_full_name(),
            'shift_date': shift.date.strftime('%A, %B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'duration': shift.duration_hours,
            'period_name': shift.schedule_period.name,
            'rejected_reason': shift.rejected_reason,
            'frontend_url': settings.FRONTEND_URL,
        }
        
        # Render HTML and text versions
        html_message = render_to_string('emails/shift_rejected.html', context)
        text_message = render_to_string('emails/shift_rejected.txt', context)
        
        # Send email
        send_mail(
            subject=f'❌ Shift Request Not Approved: {shift.date.strftime("%b %d, %Y")}',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[pa.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'Shift rejected email sent to {pa.email} for shift {shift_id}')
        return f'Email sent to {pa.email}'
        
    except ShiftRequest.DoesNotExist:
        logger.error(f'Shift {shift_id} not found')
        return f'Shift {shift_id} not found'
    
    except Exception as e:
        logger.error(f'Failed to send shift rejected email: {e}')
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def send_admin_notification_new_request(self, shift_id):
    """
    Send email notification to admin when a new shift is requested.
    """
    try:
        shift = ShiftRequest.objects.select_related(
            'requested_by', 'schedule_period'
        ).get(id=shift_id)
        
        pa = shift.requested_by
        
        # Get all admin users
        from apps.users.models import User
        admin_emails = list(User.objects.filter(role='ADMIN', is_active=True).values_list('email', flat=True))
        
        if not admin_emails:
            logger.warning('No admin users found to send notification')
            return 'No admin users found'
        
        # Context for email templates
        context = {
            'pa_name': pa.get_full_name(),
            'pa_email': pa.email,
            'shift_date': shift.date.strftime('%A, %B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'duration': shift.duration_hours,
            'period_name': shift.schedule_period.name,
            'pa_notes': shift.notes,
            'submitted_at': shift.created_at.strftime('%B %d, %Y at %I:%M %p'),
            'frontend_url': settings.FRONTEND_URL,
        }
        
        # Render HTML and text versions
        html_message = render_to_string('emails/new_request_admin.html', context)
        text_message = render_to_string('emails/new_request_admin.txt', context)
        
        # Send email to all admins
        send_mail(
            subject=f'🔔 New Shift Request from {pa.get_full_name()}',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'New request notification sent to admins for shift {shift_id}')
        return f'Email sent to {len(admin_emails)} admin(s)'
        
    except ShiftRequest.DoesNotExist:
        logger.error(f'Shift {shift_id} not found')
        return f'Shift {shift_id} not found'
    
    except Exception as e:
        logger.error(f'Failed to send admin notification: {e}')
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))