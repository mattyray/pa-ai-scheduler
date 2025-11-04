from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from .serializers import (
    UserSerializer, 
    RegisterSerializer, 
    LoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    EmailVerificationSerializer,
    UserProfileUpdateSerializer,
    PAListSerializer,
    PADetailSerializer,
    PAProfileUpdateSerializer,
)
from .models import EmailVerificationToken, PasswordResetToken, PAProfile
from .emails import send_verification_email, send_password_reset_email

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    POST: Register a new PA user
    Creates user and sends verification email
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Create verification token
        token = EmailVerificationToken.objects.create(user=user)
        
        # Send verification email (async with Celery)
        send_verification_email.delay(user.id, str(token.token))
        
        return Response({
            'message': 'Registration successful. Please check your email to verify your account.',
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    """
    POST: Verify email with token
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token_uuid = serializer.validated_data['token']
        
        try:
            token = EmailVerificationToken.objects.get(token=token_uuid)
        except EmailVerificationToken.DoesNotExist:
            return Response(
                {'error': 'Invalid verification token.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not token.is_valid():
            return Response(
                {'error': 'Verification token has expired or been used.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Mark token as used and verify user
        token.used = True
        token.save()
        
        user = token.user
        user.is_email_verified = True
        user.save()
        
        return Response({
            'message': 'Email verified successfully. You can now log in.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    """
    POST: Login with email and password
    Returns JWT access and refresh tokens
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'message': 'Login successful.',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)


class RefreshTokenView(APIView):
    """
    POST: Refresh access token using refresh token
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        refresh_token = request.data.get('refresh')
        
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            refresh = RefreshToken(refresh_token)
            return Response({
                'access': str(refresh.access_token)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(APIView):
    """
    POST: Logout (blacklist refresh token)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response(
                {'message': 'Logout successful.'},
                status=status.HTTP_200_OK
            )
        except Exception:
            return Response(
                {'error': 'Invalid token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class PasswordResetRequestView(APIView):
    """
    POST: Request password reset email
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        
        try:
            user = User.objects.get(email=email)
            
            # Create reset token
            token = PasswordResetToken.objects.create(user=user)
            
            # Send reset email (async with Celery)
            send_password_reset_email.delay(user.id, str(token.token))
            
            return Response({
                'message': 'Password reset email sent. Please check your email.',
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            # Don't reveal if email exists (security best practice)
            return Response({
                'message': 'If that email exists, a password reset link has been sent.'
            }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    POST: Reset password with token
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token_uuid = serializer.validated_data['token']
        new_password = serializer.validated_data['password']
        
        try:
            token = PasswordResetToken.objects.get(token=token_uuid)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid reset token.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not token.is_valid():
            return Response(
                {'error': 'Reset token has expired or been used.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset password
        user = token.user
        user.set_password(new_password)
        user.save()
        
        # Mark token as used
        token.used = True
        token.save()
        
        return Response({
            'message': 'Password reset successful. You can now log in with your new password.'
        }, status=status.HTTP_200_OK)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    GET: Get current user profile
    PATCH: Update current user profile
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return UserProfileUpdateSerializer
        return UserSerializer
    
class UserListView(generics.ListAPIView):
    """
    GET /api/auth/users/
    List all users (admin only) or filtered by role
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = User.objects.all().order_by('first_name', 'last_name')
        
        # Filter by role if provided
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        
        # Optional: Only admins can see all users, PAs only see other PAs
        if self.request.user.role != 'ADMIN':
            queryset = queryset.filter(role='PA')
        
        return queryset
    
# ============= PA MANAGEMENT VIEWS (ADMIN ONLY) =============

class IsAdminUser(permissions.BasePermission):
    """Custom permission: only admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'


class PAListView(generics.ListAPIView):
    """
    GET /api/pas/
    List all PA users (admin only)
    """
    serializer_class = PAListSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        return User.objects.filter(role='PA').select_related('pa_profile', 'schedule_stats').order_by('first_name', 'last_name')


class PADetailView(generics.RetrieveUpdateAPIView):
    """
    GET /api/pas/{id}/
    PATCH /api/pas/{id}/
    View and update individual PA (admin only)
    """
    permission_classes = [IsAdminUser]
    lookup_field = 'id'
    
    def get_queryset(self):
        return User.objects.filter(role='PA').select_related('pa_profile', 'schedule_stats')
    
    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return UserProfileUpdateSerializer
        return PADetailSerializer


class PAProfileUpdateView(generics.UpdateAPIView):
    """
    PATCH /api/pas/{id}/profile/
    Update PA profile settings (admin only)
    """
    serializer_class = PAProfileUpdateSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'user_id'
    
    def get_queryset(self):
        return PAProfile.objects.select_related('user').filter(user__role='PA')
    
    def get_object(self):
        user_id = self.kwargs.get('user_id')
        pa_profile = get_object_or_404(PAProfile, user_id=user_id)
        return pa_profile


class PAShiftHistoryView(APIView):
    """
    GET /api/pas/{id}/shift-history/
    Get all shifts for a PA with filtering (admin only)
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, id):
        from apps.shifts.models import ShiftRequest
        from apps.shifts.serializers import ShiftRequestSerializer
        
        # Get query params
        status = request.query_params.get('status')  # PENDING, APPROVED, REJECTED, CANCELLED
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Base query
        shifts = ShiftRequest.objects.filter(requested_by_id=id).select_related('schedule_period', 'approved_by')
        
        # Apply filters
        if status:
            shifts = shifts.filter(status=status)
        if start_date:
            shifts = shifts.filter(date__gte=start_date)
        if end_date:
            shifts = shifts.filter(date__lte=end_date)
        
        # Order by date descending
        shifts = shifts.order_by('-date', '-created_at')
        
        serializer = ShiftRequestSerializer(shifts, many=True)
        return Response(serializer.data)