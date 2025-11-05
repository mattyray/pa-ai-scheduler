from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, time, timedelta
from apps.users.models import User, PAProfile
from apps.schedules.models import SchedulePeriod
from apps.shifts.models import ShiftRequest
from decimal import Decimal


class Command(BaseCommand):
    help = 'Add pending shift requests to existing test data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Adding pending shift requests...\n')
        
        # Get existing PAs
        pa1 = User.objects.filter(email='sarah.johnson@example.com').first()
        pa2 = User.objects.filter(email='michael.chen@example.com').first()
        pa3 = User.objects.filter(email='emily.davis@example.com').first()
        
        if not pa1 or not pa2:
            self.stdout.write(self.style.ERROR('Test PAs not found. Run create_test_data first.'))
            return
        
        if not pa3:
            pa3 = User.objects.create(
                email='emily.davis@example.com',
                username='emily.davis',
                first_name='Emily',
                last_name='Davis',
                phone_number='+1-555-0103',
                role='PA',
                is_email_verified=True,
                is_active=True
            )
            pa3.set_password('testpass123')
            pa3.save()
            
            PAProfile.objects.get_or_create(
                user=pa3,
                defaults={
                    'max_hours_per_week': 30,
                    'preferred_start_time': time(6, 0),
                    'preferred_end_time': time(18, 0)
                }
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Created new PA: {pa3.get_full_name()}'))
        else:
            self.stdout.write(f'✓ Found existing PA: {pa3.get_full_name()}')
        
        # Get periods
        period1 = SchedulePeriod.objects.filter(start_date=datetime(2025, 11, 2).date()).first()
        period2 = SchedulePeriod.objects.filter(start_date=datetime(2025, 11, 9).date()).first()
        
        if not period1 or not period2:
            self.stdout.write(self.style.ERROR('Test periods not found. Run create_test_data first.'))
            return
        
        self.stdout.write(self.style.WARNING('\nCreating PENDING requests...\n'))
        
        # Week 1 - PENDING requests
        self.stdout.write('Week 1 (Nov 2-8):')
        
        # Sarah - extra morning Tuesday
        self.create_pending_request(
            period1, pa1, 
            period1.start_date + timedelta(days=1),
            time(6, 0), time(12, 0),
            "Need extra hours this week, can cover morning"
        )
        
        # Michael - afternoon Sunday  
        self.create_pending_request(
            period1, pa2,
            period1.start_date + timedelta(days=5),
            time(14, 0), time(20, 0),
            "Available for afternoon coverage"
        )
        
        # Emily - midday Thursday
        self.create_pending_request(
            period1, pa3,
            period1.start_date + timedelta(days=3),
            time(10, 0), time(16, 0),
            "New PA - available to help with coverage"
        )
        
        # Emily - Friday morning
        self.create_pending_request(
            period1, pa3,
            period1.start_date + timedelta(days=4),
            time(6, 0), time(14, 0),
            "Can cover morning shift on Friday"
        )
        
        # Week 2 - PENDING requests
        self.stdout.write('\nWeek 2 (Nov 9-15):')
        
        # Sarah - evening Monday
        self.create_pending_request(
            period2, pa1,
            period2.start_date,
            time(17, 0), time(22, 0),
            "Can work evening shift"
        )
        
        # Emily - morning Wednesday
        self.create_pending_request(
            period2, pa3,
            period2.start_date + timedelta(days=2),
            time(6, 0), time(12, 0),
            "Available for morning coverage"
        )
        
        # Michael - late night Saturday
        self.create_pending_request(
            period2, pa2,
            period2.start_date + timedelta(days=5),
            time(20, 0), time(23, 59),
            "Can cover late night if needed"
        )
        
        # Sarah - full day Sunday
        self.create_pending_request(
            period2, pa1,
            period2.start_date + timedelta(days=6),
            time(8, 0), time(18, 0),
            "Available for full day shift"
        )
        
        pending_count = ShiftRequest.objects.filter(status='PENDING').count()
        self.stdout.write(self.style.SUCCESS(f'\n✓ Total PENDING requests: {pending_count}'))
        self.stdout.write('\n🎉 You can now test approve/reject on the calendar!')

    def create_pending_request(self, period, pa, date, start_time, end_time, notes):
        """Create a pending shift request"""
        # Check if already exists
        existing = ShiftRequest.objects.filter(
            schedule_period=period,
            requested_by=pa,
            date=date,
            start_time=start_time,
            status='PENDING'
        ).first()
        
        if existing:
            self.stdout.write(f'  ⚠ Already exists: {pa.first_name} on {date.strftime("%a %m/%d")}')
            return existing
        
        # Calculate duration
        start_datetime = datetime.combine(date, start_time)
        end_datetime = datetime.combine(date, end_time)
        if end_datetime < start_datetime:
            end_datetime += timedelta(days=1)
        duration = (end_datetime - start_datetime).total_seconds() / 3600
        
        shift = ShiftRequest.objects.create(
            schedule_period=period,
            requested_by=pa,
            date=date,
            start_time=start_time,
            end_time=end_time,
            duration_hours=Decimal(str(duration)),
            status='PENDING',
            notes=notes,
            created_at=timezone.now()
        )
        
        self.stdout.write(f'  ✓ {pa.first_name} - {date.strftime("%a %m/%d")} {start_time.strftime("%I:%M%p")}-{end_time.strftime("%I:%M%p")}')
        return shift