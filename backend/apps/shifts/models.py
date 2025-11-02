from django.db import models
from django.conf import settings
from decimal import Decimal
from datetime import datetime, timedelta


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
        if self.start_time and self.end_time:
            from datetime import datetime, timedelta
            start = datetime.combine(datetime.today(), self.start_time)
            end = datetime.combine(datetime.today(), self.end_time)
            if end < start:
                end += timedelta(days=1)
            duration = (end - start).total_seconds() / 3600
            self.duration_hours = Decimal(str(duration))
        super().save(*args, **kwargs)


class ShiftSuggestion(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('DECLINED', 'Declined'),
        ('EXPIRED', 'Expired'),
    ]
    
    suggested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='suggestions_made'
    )
    suggested_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='suggestions_received'
    )
    schedule_period = models.ForeignKey('schedules.SchedulePeriod', on_delete=models.CASCADE)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_hours = models.DecimalField(max_digits=4, decimal_places=2)
    message = models.TextField(blank=True)
    decline_reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    related_shift_request = models.ForeignKey(
        ShiftRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_suggestion'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'shift_suggestions'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            from datetime import datetime, timedelta
            start = datetime.combine(datetime.today(), self.start_time)
            end = datetime.combine(datetime.today(), self.end_time)
            if end < start:
                end += timedelta(days=1)
            duration = (end - start).total_seconds() / 3600
            self.duration_hours = Decimal(str(duration))
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Suggestion from {self.suggested_by} to {self.suggested_to} for {self.date}"
