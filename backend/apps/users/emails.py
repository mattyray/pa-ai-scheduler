from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_verification_email(self, user_id, token):
    """
    Send email verification link to new user.
    """
    try:
        from apps.users.models import User
        
        user = User.objects.get(id=user_id)
        
        # Build verification URL
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        
        # Context for email templates
        context = {
            'user_name': user.get_full_name() or user.email,
            'verification_url': verification_url,
        }
        
        # Render HTML and text versions
        html_message = render_to_string('emails/verification.html', context)
        text_message = render_to_string('emails/verification.txt', context)
        
        # Send email
        send_mail(
            subject='✉️ Verify Your Email - PA Scheduling System',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'Verification email sent to {user.email}')
        return f'Email sent to {user.email}'
        
    except Exception as e:
        logger.error(f'Failed to send verification email: {e}')
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def send_password_reset_email(self, user_id, token):
    """
    Send password reset link to user.
    """
    try:
        from apps.users.models import User
        
        user = User.objects.get(id=user_id)
        
        # Build reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        # Context for email templates
        context = {
            'user_name': user.get_full_name() or user.email,
            'reset_url': reset_url,
        }
        
        # Render HTML and text versions
        html_message = render_to_string('emails/password_reset.html', context)
        text_message = render_to_string('emails/password_reset.txt', context)
        
        # Send email
        send_mail(
            subject='🔐 Password Reset - PA Scheduling System',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f'Password reset email sent to {user.email}')
        return f'Email sent to {user.email}'
        
    except Exception as e:
        logger.error(f'Failed to send password reset email: {e}')
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))