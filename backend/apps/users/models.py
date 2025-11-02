from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import uuid
from datetime import timedelta


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Email is the primary identifier instead of username.
    """
    email = models.EmailField(unique=True, db_index=True)
    phone_number = models.CharField(max_length=20)
    
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('PA', 'Personal Assistant'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='PA')
    
    is_email_verified = models.BooleanField(default=False)
    
    # Make email the login field instead of username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
    
    def save(self, *args, **kwargs):
        # Normalize email to lowercase
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)


class EmailVerificationToken(models.Model):
    """Token for email verification"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'email_verification_tokens'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)
    
    def is_valid(self):
        """Check if token is still valid"""
        return not self.used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Verification token for {self.user.email}"


class PasswordResetToken(models.Model):
    """Token for password reset"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)
    
    def is_valid(self):
        """Check if token is still valid"""
        return not self.used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Password reset token for {self.user.email}"


class PAProfile(models.Model):
    """
    Extended profile for PA users with preferences and scheduling settings.
    One-to-one relationship with User where role='PA'.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='pa_profile',
        limit_choices_to={'role': 'PA'}
    )
    
    # Preferred working hours
    preferred_start_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Preferred shift start time (e.g., 08:00)"
    )
    preferred_end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Preferred shift end time (e.g., 16:00)"
    )
    
    # Preferred working days (stored as JSON array)
    preferred_days = models.JSONField(
        default=list,
        blank=True,
        help_text='List of preferred days: ["monday", "tuesday", ...]'
    )
    
    # Weekly hour limit
    max_hours_per_week = models.IntegerField(
        default=40,
        help_text="Maximum hours this PA can work per week"
    )
    
    # Admin notes about this PA
    notes = models.TextField(
        blank=True,
        help_text="Internal notes about this PA (admin only)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'pa_profiles'
        verbose_name = 'PA Profile'
        verbose_name_plural = 'PA Profiles'
    
    def __str__(self):
        return f"Profile for {self.user.get_full_name()}"


class PAScheduleStats(models.Model):
    """
    Historical pattern tracking for each PA.
    Used by AI for predictive scheduling and conflict resolution.
    """
    pa = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='schedule_stats',
        limit_choices_to={'role': 'PA'}
    )
    
    # Lifetime statistics
    total_shifts_worked = models.IntegerField(default=0)
    total_hours_worked = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    average_hours_per_week = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Pattern data (stored as JSON)
    most_common_days = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"monday": 15, "wednesday": 12, ...}'
    )
    most_common_start_time = models.TimeField(null=True, blank=True)
    most_common_shift_length = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average shift duration in hours"
    )
    
    # Behavioral patterns
    preferred_shift_pattern = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ('morning', 'Morning (6-9 AM)'),
            ('evening', 'Evening (9-10 PM)'),
            ('full_day', 'Full Day'),
            ('mixed', 'Mixed'),
        ]
    )
    
    # Reliability metrics
    reliability_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100.0,
        help_text="Percentage of completed shifts without cancellation (0-100)"
    )
    
    # Request timing
    typical_request_timing = models.IntegerField(
        null=True,
        blank=True,
        help_text="Average days before shift date that PA typically requests"
    )
    consecutive_days_preference = models.IntegerField(
        null=True,
        blank=True,
        help_text="Average number of consecutive days worked"
    )
    
    # Last activity
    last_worked_date = models.DateField(null=True, blank=True)
    last_calculated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'pa_schedule_stats'
        verbose_name = 'PA Schedule Statistics'
        verbose_name_plural = 'PA Schedule Statistics'
    
    def __str__(self):
        return f"Stats for {self.pa.get_full_name()}"