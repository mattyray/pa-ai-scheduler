from django.urls import path
from .views import (
    RegisterView,
    VerifyEmailView,
    LoginView,
    RefreshTokenView,
    LogoutView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserProfileView,
    UserListView,
    PAListView,
    PADetailView,
    PAProfileUpdateView,
    PAShiftHistoryView,
)

app_name = 'users'

urlpatterns = [
    # Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Password Reset
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Profile & Users
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('users/', UserListView.as_view(), name='user-list'),
    
    # PA Management (Admin Only)
    path('pas/', PAListView.as_view(), name='pa-list'),
    path('pas/<int:id>/', PADetailView.as_view(), name='pa-detail'),
    path('pas/<int:user_id>/profile/', PAProfileUpdateView.as_view(), name='pa-profile-update'),
    path('pas/<int:id>/shift-history/', PAShiftHistoryView.as_view(), name='pa-shift-history'),
]