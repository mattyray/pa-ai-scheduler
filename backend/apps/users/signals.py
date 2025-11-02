from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, PAProfile, PAScheduleStats


@receiver(post_save, sender=User)
def create_pa_profile(sender, instance, created, **kwargs):
    """
    Automatically create PAProfile and PAScheduleStats when a PA user is created.
    """
    if created and instance.role == 'PA':
        PAProfile.objects.get_or_create(user=instance)
        PAScheduleStats.objects.get_or_create(pa=instance)


@receiver(post_save, sender=User)
def save_pa_profile(sender, instance, **kwargs):
    """
    Save PAProfile when User is saved (if it exists).
    """
    if instance.role == 'PA' and hasattr(instance, 'pa_profile'):
        instance.pa_profile.save()