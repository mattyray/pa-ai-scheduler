from django.contrib.auth.models import AbstractUser
from django.db import models


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