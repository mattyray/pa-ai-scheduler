from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, PAProfile, PAScheduleStats


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User responses"""
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 
                  'phone_number', 'role', 'is_email_verified', 'date_joined']
        read_only_fields = ['id', 'date_joined', 'is_email_verified']


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 
                  'first_name', 'last_name', 'phone_number']

    def validate_email(self, value):
        """Ensure email is lowercase and unique"""
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        """Check that passwords match"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs

    def create(self, validated_data):
        """Create new user with hashed password"""
        validated_data.pop('password_confirm')
        
        # Auto-generate username from email
        email = validated_data['email']
        username = email.split('@')[0]
        
        # Ensure username is unique
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        user = User.objects.create_user(
            email=validated_data['email'],
            username=username,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data['phone_number'],
            role='PA'
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_email(self, value):
        """Normalize email to lowercase"""
        return value.lower()

    def validate(self, attrs):
        """Authenticate user"""
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )

            if not user:
                raise serializers.ValidationError(
                    'Unable to log in with provided credentials.',
                    code='authorization'
                )
            
            if not user.is_active:
                raise serializers.ValidationError(
                    'User account is disabled.',
                    code='authorization'
                )

            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError(
                'Must include "email" and "password".',
                code='authorization'
            )


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting password reset"""
    email = serializers.EmailField()

    def validate_email(self, value):
        """Normalize email to lowercase"""
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming password reset"""
    token = serializers.UUIDField()
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        """Check that passwords match"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs


class EmailVerificationSerializer(serializers.Serializer):
    """Serializer for email verification"""
    token = serializers.UUIDField()


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone_number']

    def validate_phone_number(self, value):
        """Ensure phone number is provided"""
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        return value


class PAProfileSerializer(serializers.ModelSerializer):
    """Serializer for PA profile data"""
    class Meta:
        model = PAProfile
        fields = [
            'preferred_start_time',
            'preferred_end_time', 
            'preferred_days',
            'max_hours_per_week',
            'notes'
        ]


class PAScheduleStatsSerializer(serializers.ModelSerializer):
    """Serializer for PA statistics"""
    class Meta:
        model = PAScheduleStats
        fields = [
            'total_shifts_worked',
            'total_hours_worked',
            'average_hours_per_week',
            'most_common_days',
            'most_common_start_time',
            'most_common_shift_length',
            'preferred_shift_pattern',
            'reliability_score',
            'typical_request_timing',
            'consecutive_days_preference',
            'last_worked_date',
            'last_calculated'
        ]


class PAListSerializer(serializers.ModelSerializer):
    """Serializer for listing PAs (summary view)"""
    max_hours_per_week = serializers.SerializerMethodField()
    total_shifts = serializers.SerializerMethodField()
    total_hours = serializers.SerializerMethodField()
    reliability_score = serializers.SerializerMethodField()
    last_worked_date = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'is_email_verified',
            'is_active',
            'date_joined',
            'max_hours_per_week',
            'total_shifts',
            'total_hours',
            'reliability_score',
            'last_worked_date'
        ]
    
    def get_max_hours_per_week(self, obj):
        try:
            return obj.pa_profile.max_hours_per_week
        except:
            return 40
    
    def get_total_shifts(self, obj):
        try:
            return obj.schedule_stats.total_shifts_worked
        except:
            return 0
    
    def get_total_hours(self, obj):
        try:
            return float(obj.schedule_stats.total_hours_worked)
        except:
            return 0.0
    
    def get_reliability_score(self, obj):
        try:
            return float(obj.schedule_stats.reliability_score)
        except:
            return 100.0
    
    def get_last_worked_date(self, obj):
        try:
            return obj.schedule_stats.last_worked_date
        except:
            return None


class PADetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for individual PA view"""
    profile = PAProfileSerializer(source='pa_profile', read_only=True)
    stats = PAScheduleStatsSerializer(source='schedule_stats', read_only=True)
    recent_shifts = serializers.SerializerMethodField()
    upcoming_shifts = serializers.SerializerMethodField()
    pending_requests = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'phone_number',
            'is_email_verified',
            'is_active',
            'date_joined',
            'last_login',
            'profile',
            'stats',
            'recent_shifts',
            'upcoming_shifts',
            'pending_requests'
        ]
        read_only_fields = [
            'id',
            'email',
            'username',
            'date_joined',
            'last_login'
        ]
    
    def get_recent_shifts(self, obj):
        """Get last 10 completed shifts"""
        from datetime import date
        from apps.shifts.models import ShiftRequest
        
        shifts = ShiftRequest.objects.filter(
            requested_by=obj,
            status='APPROVED',
            date__lt=date.today()
        ).select_related('schedule_period').order_by('-date')[:10]
        
        return [{
            'id': shift.id,
            'date': shift.date,
            'start_time': shift.start_time,
            'end_time': shift.end_time,
            'duration_hours': float(shift.duration_hours),
            'schedule_period_name': shift.schedule_period.name
        } for shift in shifts]
    
    def get_upcoming_shifts(self, obj):
        """Get upcoming approved shifts"""
        from datetime import date
        from apps.shifts.models import ShiftRequest
        
        shifts = ShiftRequest.objects.filter(
            requested_by=obj,
            status='APPROVED',
            date__gte=date.today()
        ).select_related('schedule_period').order_by('date')[:10]
        
        return [{
            'id': shift.id,
            'date': shift.date,
            'start_time': shift.start_time,
            'end_time': shift.end_time,
            'duration_hours': float(shift.duration_hours),
            'schedule_period_name': shift.schedule_period.name
        } for shift in shifts]
    
    def get_pending_requests(self, obj):
        """Get pending shift requests"""
        from apps.shifts.models import ShiftRequest
        
        requests = ShiftRequest.objects.filter(
            requested_by=obj,
            status='PENDING'
        ).select_related('schedule_period').order_by('date')
        
        return [{
            'id': request.id,
            'date': request.date,
            'start_time': request.start_time,
            'end_time': request.end_time,
            'duration_hours': float(request.duration_hours),
            'schedule_period_name': request.schedule_period.name,
            'created_at': request.created_at
        } for request in requests]


class PAProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating PA profile (admin only)"""
    class Meta:
        model = PAProfile
        fields = ['max_hours_per_week', 'notes']


        