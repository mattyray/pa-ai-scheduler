from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags


@shared_task
def send_new_request_email(request_id):
    from .models import ShiftRequest
    try:
        shift_request = ShiftRequest.objects.get(id=request_id)
        admin_users = shift_request.requested_by.__class__.objects.filter(role='ADMIN')
        
        for admin in admin_users:
            context = {
                'pa_name': shift_request.requested_by.get_full_name(),
                'date': shift_request.date.strftime('%B %d, %Y'),
                'start_time': shift_request.start_time.strftime('%I:%M %p'),
                'end_time': shift_request.end_time.strftime('%I:%M %p'),
                'duration': shift_request.duration_hours,
                'notes': shift_request.notes,
                'period_name': shift_request.schedule_period.name,
            }
            
            html_message = render_to_string('emails/new_request_admin.html', context)
            plain_message = render_to_string('emails/new_request_admin.txt', context)
            
            send_mail(
                subject=f'New Shift Request from {shift_request.requested_by.get_full_name()}',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin.email],
                html_message=html_message,
                fail_silently=False,
            )
    except Exception as e:
        print(f"Error sending new request email: {e}")


@shared_task
def send_shift_approved_email(shift_id):
    from .models import ShiftRequest
    try:
        shift = ShiftRequest.objects.get(id=shift_id)
        
        context = {
            'pa_name': shift.requested_by.first_name,
            'admin_name': shift.approved_by.get_full_name() if shift.approved_by else 'Admin',
            'date': shift.date.strftime('%B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'duration': shift.duration_hours,
            'period_name': shift.schedule_period.name,
            'admin_notes': shift.admin_notes,
            'schedule_url': f'{settings.FRONTEND_URL}/schedule',
        }
        
        html_message = render_to_string('emails/shift_approved.html', context)
        plain_message = render_to_string('emails/shift_approved.txt', context)
        
        send_mail(
            subject='Your Shift Request Has Been Approved',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending approval email: {e}")


@shared_task
def send_shift_rejected_email(shift_id):
    from .models import ShiftRequest
    try:
        shift = ShiftRequest.objects.get(id=shift_id)
        
        context = {
            'pa_name': shift.requested_by.first_name,
            'date': shift.date.strftime('%B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'duration': shift.duration_hours,
            'period_name': shift.schedule_period.name,
            'rejected_reason': shift.rejected_reason,
            'new_request_url': f'{settings.FRONTEND_URL}/requests/new',
        }
        
        html_message = render_to_string('emails/shift_rejected.html', context)
        plain_message = render_to_string('emails/shift_rejected.txt', context)
        
        send_mail(
            subject='Shift Request Not Approved',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending rejection email: {e}")


@shared_task
def send_shift_suggestion_email(suggestion_id):
    from .models import ShiftSuggestion
    try:
        suggestion = ShiftSuggestion.objects.get(id=suggestion_id)
        
        context = {
            'pa_name': suggestion.suggested_to.first_name,
            'admin_name': suggestion.suggested_by.get_full_name(),
            'date': suggestion.date.strftime('%B %d, %Y'),
            'start_time': suggestion.start_time.strftime('%I:%M %p'),
            'end_time': suggestion.end_time.strftime('%I:%M %p'),
            'duration': suggestion.duration_hours,
            'message': suggestion.message,
            'dashboard_url': f'{settings.FRONTEND_URL}/dashboard',
        }
        
        html_message = render_to_string('emails/shift_suggested.html', context)
        plain_message = render_to_string('emails/shift_suggested.txt', context)
        
        send_mail(
            subject=f'Shift Suggestion from {suggestion.suggested_by.get_full_name()}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[suggestion.suggested_to.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending suggestion email: {e}")


@shared_task
def notify_admin_suggestion_accepted(suggestion_id):
    from .models import ShiftSuggestion
    try:
        suggestion = ShiftSuggestion.objects.get(id=suggestion_id)
        
        context = {
            'admin_name': suggestion.suggested_by.first_name,
            'pa_name': suggestion.suggested_to.get_full_name(),
            'date': suggestion.date.strftime('%B %d, %Y'),
            'start_time': suggestion.start_time.strftime('%I:%M %p'),
            'end_time': suggestion.end_time.strftime('%I:%M %p'),
            'requests_url': f'{settings.FRONTEND_URL}/requests',
        }
        
        html_message = render_to_string('emails/suggestion_accepted.html', context)
        plain_message = render_to_string('emails/suggestion_accepted.txt', context)
        
        send_mail(
            subject=f'{suggestion.suggested_to.get_full_name()} Accepted Your Shift Suggestion',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[suggestion.suggested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending accepted notification: {e}")


@shared_task
def notify_admin_suggestion_declined(suggestion_id):
    from .models import ShiftSuggestion
    try:
        suggestion = ShiftSuggestion.objects.get(id=suggestion_id)
        
        context = {
            'admin_name': suggestion.suggested_by.first_name,
            'pa_name': suggestion.suggested_to.get_full_name(),
            'date': suggestion.date.strftime('%B %d, %Y'),
            'start_time': suggestion.start_time.strftime('%I:%M %p'),
            'end_time': suggestion.end_time.strftime('%I:%M %p'),
            'reason': suggestion.decline_reason,
        }
        
        html_message = render_to_string('emails/suggestion_declined.html', context)
        plain_message = render_to_string('emails/suggestion_declined.txt', context)
        
        send_mail(
            subject=f'{suggestion.suggested_to.get_full_name()} Declined Your Shift Suggestion',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[suggestion.suggested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending declined notification: {e}")


@shared_task
def send_shift_edited_notification(shift_id, old_date, old_start_time, old_end_time):
    from .models import ShiftRequest
    from datetime import datetime
    try:
        shift = ShiftRequest.objects.get(id=shift_id)
        
        old_date_formatted = datetime.strptime(old_date, '%Y-%m-%d').strftime('%B %d, %Y')
        old_start_formatted = datetime.strptime(old_start_time, '%H:%M:%S').strftime('%I:%M %p')
        old_end_formatted = datetime.strptime(old_end_time, '%H:%M:%S').strftime('%I:%M %p')
        
        context = {
            'pa_name': shift.requested_by.first_name,
            'old_date': old_date_formatted,
            'old_start_time': old_start_formatted,
            'old_end_time': old_end_formatted,
            'new_date': shift.date.strftime('%B %d, %Y'),
            'new_start_time': shift.start_time.strftime('%I:%M %p'),
            'new_end_time': shift.end_time.strftime('%I:%M %p'),
            'admin_notes': shift.admin_notes,
            'schedule_url': f'{settings.FRONTEND_URL}/schedule',
        }
        
        html_message = render_to_string('emails/shift_edited.html', context)
        plain_message = render_to_string('emails/shift_edited.txt', context)
        
        send_mail(
            subject='Your Shift Has Been Updated',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending shift edited email: {e}")


@shared_task
def send_shift_cancelled_by_pa_notification(shift_id, cancellation_reason):
    from .models import ShiftRequest
    try:
        shift = ShiftRequest.objects.get(id=shift_id)
        admin_users = shift.requested_by.__class__.objects.filter(role='ADMIN')
        
        coverage_warning = ''
        from datetime import time
        if (shift.start_time <= time(6, 0) and shift.end_time >= time(9, 0)):
            coverage_warning = '⚠️ WARNING: This shift covered the critical MORNING time slot (6-9 AM). This date may now have a coverage gap.'
        elif (shift.start_time <= time(21, 0) and shift.end_time >= time(22, 0)):
            coverage_warning = '⚠️ WARNING: This shift covered the critical EVENING time slot (9-10 PM). This date may now have a coverage gap.'
        
        for admin in admin_users:
            context = {
                'admin_name': admin.first_name,
                'pa_name': shift.requested_by.get_full_name(),
                'date': shift.date.strftime('%B %d, %Y'),
                'start_time': shift.start_time.strftime('%I:%M %p'),
                'end_time': shift.end_time.strftime('%I:%M %p'),
                'duration': shift.duration_hours,
                'cancellation_reason': cancellation_reason,
                'coverage_warning': coverage_warning,
                'schedule_url': f'{settings.FRONTEND_URL}/schedule',
            }
            
            html_message = render_to_string('emails/shift_cancelled_by_pa.html', context)
            plain_message = render_to_string('emails/shift_cancelled_by_pa.txt', context)
            
            send_mail(
                subject=f'⚠️ Shift Cancelled by {shift.requested_by.get_full_name()}',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin.email],
                html_message=html_message,
                fail_silently=False,
            )
    except Exception as e:
        print(f"Error sending PA cancellation email: {e}")


@shared_task
def send_shift_cancelled_by_admin_notification(shift_id, cancellation_reason):
    from .models import ShiftRequest
    try:
        shift = ShiftRequest.objects.get(id=shift_id)
        
        context = {
            'pa_name': shift.requested_by.first_name,
            'date': shift.date.strftime('%B %d, %Y'),
            'start_time': shift.start_time.strftime('%I:%M %p'),
            'end_time': shift.end_time.strftime('%I:%M %p'),
            'cancellation_reason': cancellation_reason,
            'schedule_url': f'{settings.FRONTEND_URL}/schedule',
        }
        
        html_message = render_to_string('emails/shift_cancelled_by_admin.html', context)
        plain_message = render_to_string('emails/shift_cancelled_by_admin.txt', context)
        
        send_mail(
            subject='Your Shift Has Been Cancelled',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending admin cancellation email: {e}")