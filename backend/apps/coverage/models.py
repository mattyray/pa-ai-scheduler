# apps/coverage/models.py
from django.db import models
from django.conf import settings


class CriticalTimeCoverage(models.Model):
    """
    Tracks whether critical times (6-9 AM morning, 9-10 PM evening) are covered for each date.
    Updated automatically when shifts are approved/rejected/deleted.
    """
    date = models.DateField(unique=True, db_index=True)
    morning_covered = models.BooleanField(default=False)  # 6-9 AM
    evening_covered = models.BooleanField(default=False)  # 9-10 PM
    morning_shift = models.ForeignKey(
        'shifts.ShiftRequest', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='covers_morning'
    )
    evening_shift = models.ForeignKey(
        'shifts.ShiftRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='covers_evening'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'critical_time_coverage'
        ordering = ['date']
        verbose_name = 'Critical Time Coverage'
        verbose_name_plural = 'Critical Time Coverage'
    
    def __str__(self):
        status = []
        if self.morning_covered:
            status.append('Morning ✅')
        else:
            status.append('Morning ❌')
        if self.evening_covered:
            status.append('Evening ✅')
        else:
            status.append('Evening ❌')
        return f"{self.date} - {' | '.join(status)}"
    
    @property
    def is_fully_covered(self):
        """Returns True if both morning and evening are covered"""
        return self.morning_covered and self.evening_covered
    
    @property
    def coverage_status(self):
        """Returns coverage status: 'complete', 'partial', or 'none'"""
        if self.morning_covered and self.evening_covered:
            return 'complete'
        elif self.morning_covered or self.evening_covered:
            return 'partial'
        return 'none'


class WeeklyCoverage(models.Model):
    """
    Tracks total hours worked by each PA per week within a schedule period.
    Used for overtime warnings and weekly limit checks.
    """
    schedule_period = models.ForeignKey(
        'schedules.SchedulePeriod', 
        on_delete=models.CASCADE,
        related_name='weekly_coverage'
    )
    pa = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='weekly_hours'
    )
    week_start_date = models.DateField(db_index=True)  # Monday of the week
    total_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    exceeds_limit = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'weekly_coverage'
        unique_together = ['schedule_period', 'pa', 'week_start_date']
        ordering = ['week_start_date', 'pa']
        verbose_name = 'Weekly Coverage'
        verbose_name_plural = 'Weekly Coverage'
    
    def __str__(self):
        warning = " ⚠️ OVERTIME" if self.exceeds_limit else ""
        return f"{self.pa.get_full_name()} - Week of {self.week_start_date}: {self.total_hours}h{warning}"
    
    def check_exceeds_limit(self, max_hours=40):
        """
        Check if total hours exceed the limit.
        max_hours can be passed from PA's custom limit or default 40.
        """
        self.exceeds_limit = self.total_hours > max_hours
        return self.exceeds_limit