# apps/schedules/models.py - NEEDS TO BE CREATED
from django.db import models
from django.conf import settings

class SchedulePeriod(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('LOCKED', 'Locked'),
        ('FINALIZED', 'Finalized'),
    ]
    
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'schedule_periods'
        ordering = ['-start_date']