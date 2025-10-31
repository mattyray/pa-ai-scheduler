# apps/shifts/models.py - NEEDS TO BE CREATED
from django.db import models
from django.conf import settings
from decimal import Decimal

class ShiftRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    schedule_period = models.ForeignKey('schedules.SchedulePeriod', on_delete=models.CASCADE)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_hours = models.DecimalField(max_digits=4, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    rejected_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='approved_shifts'
    )
    
    class Meta:
        db_table = 'shift_requests'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        # Auto-calculate duration
        if self.start_time and self.end_time:
            from datetime import datetime, timedelta
            start = datetime.combine(datetime.today(), self.start_time)
            end = datetime.combine(datetime.today(), self.end_time)
            if end < start:
                end += timedelta(days=1)
            duration = (end - start).total_seconds() / 3600
            self.duration_hours = Decimal(str(duration))
        super().save(*args, **kwargs)