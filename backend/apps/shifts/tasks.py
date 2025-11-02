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
def send_shift_approved_email(request_id):
    from .models import ShiftRequest
    try:
        shift_request = ShiftRequest.objects.get(id=request_id)
        
        context = {
            'pa_name': shift_request.requested_by.first_name,
            'date': shift_request.date.strftime('%B %d, %Y'),
            'start_time': shift_request.start_time.strftime('%I:%M %p'),
            'end_time': shift_request.end_time.strftime('%I:%M %p'),
            'duration': shift_request.duration_hours,
            'admin_notes': shift_request.admin_notes,
        }
        
        html_message = render_to_string('emails/shift_approved.html', context)
        plain_message = render_to_string('emails/shift_approved.txt', context)
        
        send_mail(
            subject='Shift Request Approved',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift_request.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending approved email: {e}")


@shared_task
def send_shift_rejected_email(request_id):
    from .models import ShiftRequest
    try:
        shift_request = ShiftRequest.objects.get(id=request_id)
        
        context = {
            'pa_name': shift_request.requested_by.first_name,
            'date': shift_request.date.strftime('%B %d, %Y'),
            'start_time': shift_request.start_time.strftime('%I:%M %p'),
            'end_time': shift_request.end_time.strftime('%I:%M %p'),
            'reason': shift_request.rejected_reason,
        }
        
        html_message = render_to_string('emails/shift_rejected.html', context)
        plain_message = render_to_string('emails/shift_rejected.txt', context)
        
        send_mail(
            subject='Shift Request Rejected',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[shift_request.requested_by.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending rejected email: {e}")


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
