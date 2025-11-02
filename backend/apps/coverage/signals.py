from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.shifts.models import ShiftRequest
from .utils import update_coverage_for_shift


@receiver(post_save, sender=ShiftRequest)
def shift_saved(sender, instance, **kwargs):
    """
    Update coverage whenever a shift is saved.
    Only update for approved shifts.
    """
    if instance.status == 'APPROVED':
        update_coverage_for_shift(instance)


@receiver(post_delete, sender=ShiftRequest)
def shift_deleted(sender, instance, **kwargs):
    """
    Update coverage when a shift is deleted.
    """
    if instance.status == 'APPROVED':
        update_coverage_for_shift(instance),