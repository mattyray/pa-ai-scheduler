from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, time, timedelta
from apps.users.models import User, PAProfile
from apps.schedules.models import SchedulePeriod
from apps.shifts.models import ShiftRequest
from decimal import Decimal


class Command(BaseCommand):
    help = 'Create test data for PA scheduling system'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating test data...\n')
        
        # Get or create admin user
        admin = User.objects.filter(role='ADMIN').first()
        if not admin:
            self.stdout.write(self.style.ERROR('No admin user found. Please create an admin first.'))
            return
        
        # Create test PAs
        pa1 = self.create_test_pa(
            email='sarah.johnson@example.com',
            first_name='Sarah',
            last_name='Johnson',
            phone='+1-555-0101',
            max_hours=40
        )
        
        pa2 = self.create_test_pa(
            email='michael.chen@example.com',
            first_name='Michael',
            last_name='Chen',
            phone='+1-555-0102',
            max_hours=35
        )
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created PA: {pa1.get_full_name()}'))
        self.stdout.write(self.style.SUCCESS(f'✓ Created PA: {pa2.get_full_name()}'))
        
        # Get existing period (Nov 2-8)
        period1 = SchedulePeriod.objects.filter(
            start_date=datetime(2025, 11, 2).date()
        ).first()
        
        if not period1:
            period1 = SchedulePeriod.objects.create(
                name='November 2-8, 2025',
                start_date=datetime(2025, 11, 2).date(),
                end_date=datetime(2025, 11, 8).date(),
                status='OPEN',
                created_by=admin
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Created period: {period1.name}'))
        else:
            self.stdout.write(f'✓ Using existing period: {period1.name}')
        
        # Create new period (Nov 9-15)
        period2, created = SchedulePeriod.objects.get_or_create(
            start_date=datetime(2025, 11, 9).date(),
            defaults={
                'name': 'November 9-15, 2025',
                'end_date': datetime(2025, 11, 15).date(),
                'status': 'OPEN',
                'created_by': admin
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created period: {period2.name}'))
        else:
            self.stdout.write(f'✓ Period already exists: {period2.name}')
        
        # Create shifts for Period 1 (Nov 2-8)
        self.stdout.write('\nCreating shifts for Week 1 (Nov 2-8)...')
        self.create_week_shifts(period1, pa1, pa2, admin)
        
        # Create shifts for Period 2 (Nov 9-15)
        self.stdout.write('\nCreating shifts for Week 2 (Nov 9-15)...')
        self.create_week_shifts(period2, pa1, pa2, admin)
        
        self.stdout.write(self.style.SUCCESS('\n✓ Test data created successfully!'))
        self.stdout.write('\nSummary:')
        self.stdout.write(f'  - 2 Test PAs created')
        self.stdout.write(f'  - 2 Schedule periods')
        self.stdout.write(f'  - {ShiftRequest.objects.filter(status="APPROVED").count()} approved shifts')

    def create_test_pa(self, email, first_name, last_name, phone, max_hours):
        """Create or get a test PA user"""
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'first_name': first_name,
                'last_name': last_name,
                'phone_number': phone,
                'role': 'PA',
                'is_email_verified': True,
                'is_active': True
            }
        )
        
        if created:
            user.set_password('testpass123')
            user.save()
        
        # Create or update PA profile
        profile, _ = PAProfile.objects.get_or_create(
            user=user,
            defaults={
                'max_hours_per_week': max_hours,
                'preferred_start_time': time(6, 0),
                'preferred_end_time': time(18, 0),
                'preferred_days': ['monday', 'wednesday', 'friday']
            }
        )
        
        return user

    def create_week_shifts(self, period, pa1, pa2, admin):
        """Create shifts for a week"""
        start_date = period.start_date
        
        # Pattern: Alternating coverage
        # Sarah: Morning shifts (6-9 AM) on Mon, Wed, Fri, Sun
        # Michael: Morning shifts on Tue, Thu, Sat
        # Both cover evenings (9-10 PM) on alternating days
        
        for day_offset in range(7):
            current_date = start_date + timedelta(days=day_offset)
            day_name = current_date.strftime('%A')
            
            # Morning shifts (6-9 AM) - Critical time coverage
            if day_name in ['Monday', 'Wednesday', 'Friday', 'Sunday']:
                self.create_shift(period, pa1, current_date, time(6, 0), time(14, 0), admin)
                self.stdout.write(f'  {current_date.strftime("%a %m/%d")}: Sarah 6am-2pm')
            else:
                self.create_shift(period, pa2, current_date, time(6, 0), time(14, 0), admin)
                self.stdout.write(f'  {current_date.strftime("%a %m/%d")}: Michael 6am-2pm')
            
            # Evening shifts (6-10 PM) - Covers evening critical time
            if day_name in ['Monday', 'Thursday', 'Saturday']:
                self.create_shift(period, pa2, current_date, time(18, 0), time(22, 0), admin)
                self.stdout.write(f'  {current_date.strftime("%a %m/%d")}: Michael 6pm-10pm')
            elif day_name in ['Tuesday', 'Friday', 'Sunday']:
                self.create_shift(period, pa1, current_date, time(18, 0), time(22, 0), admin)
                self.stdout.write(f'  {current_date.strftime("%a %m/%d")}: Sarah 6pm-10pm')
            
            # Wednesday: Full day for Michael (overlap example)
            if day_name == 'Wednesday':
                # Michael also gets evening shift
                self.create_shift(period, pa2, current_date, time(18, 0), time(22, 0), admin)
                self.stdout.write(f'  {current_date.strftime("%a %m/%d")}: Michael 6pm-10pm (double shift)')

    def create_shift(self, period, pa, date, start_time, end_time, admin):
        """Create an approved shift"""
        # Check if shift already exists
        existing = ShiftRequest.objects.filter(
            schedule_period=period,
            requested_by=pa,
            date=date,
            start_time=start_time,
            end_time=end_time
        ).first()
        
        if existing:
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
            status='APPROVED',
            approved_by=admin,
            approved_at=timezone.now(),
            notes=f'Test shift for {pa.first_name}'
        )
        
        return shift