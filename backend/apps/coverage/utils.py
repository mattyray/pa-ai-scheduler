from datetime import time, timedelta
from apps.shifts.models import ShiftRequest
from .models import CriticalTimeCoverage, WeeklyCoverage


def calculate_critical_coverage(date):
    """
    Calculate and update critical time coverage for a specific date.
    
    Critical Times:
    - Morning: 6:00 AM - 9:00 AM (must cover full 3 hours)
    - Evening: 9:00 PM - 10:00 PM (must cover full 1 hour)
    
    Handles overnight shifts correctly (when end_time < start_time).
    
    Args:
        date: datetime.date object
    
    Returns:
        CriticalTimeCoverage instance
    """
    coverage, created = CriticalTimeCoverage.objects.get_or_create(date=date)
    
    shifts = ShiftRequest.objects.filter(
        date=date,
        status='APPROVED'
    )
    
    coverage.morning_covered = False
    coverage.evening_covered = False
    coverage.morning_shift = None
    coverage.evening_shift = None
    
    for shift in shifts:
        is_overnight = shift.end_time < shift.start_time
        
        if is_overnight:
            if shift.start_time <= time(21, 0):
                coverage.evening_covered = True
                coverage.evening_shift = shift
            
            if shift.end_time >= time(9, 0):
                coverage.morning_covered = True
                coverage.morning_shift = shift
        else:
            if shift.start_time <= time(6, 0) and shift.end_time >= time(9, 0):
                coverage.morning_covered = True
                coverage.morning_shift = shift
            
            if shift.start_time <= time(21, 0) and shift.end_time >= time(22, 0):
                coverage.evening_covered = True
                coverage.evening_shift = shift
    
    coverage.save()
    return coverage


def calculate_weekly_hours(pa, week_start_date):
    """
    Calculate and update weekly hours for a PA.
    
    Args:
        pa: User instance (PA)
        week_start_date: datetime.date (Monday of the week)
    
    Returns:
        WeeklyCoverage instance
    """
    from apps.users.models import User
    
    if week_start_date.weekday() != 0:
        week_start_date = week_start_date - timedelta(days=week_start_date.weekday())
    
    week_end_date = week_start_date + timedelta(days=6)
    
    shifts = ShiftRequest.objects.filter(
        requested_by=pa,
        status='APPROVED',
        date__gte=week_start_date,
        date__lte=week_end_date
    )
    
    total_hours = sum(shift.duration_hours for shift in shifts)
    
    max_hours = 40
    if hasattr(pa, 'pa_profile'):
        max_hours = pa.pa_profile.max_hours_per_week
    
    schedule_period = None
    if shifts.exists():
        schedule_period = shifts.first().schedule_period
    
    if schedule_period:
        coverage, created = WeeklyCoverage.objects.get_or_create(
            schedule_period=schedule_period,
            pa=pa,
            week_start_date=week_start_date,
            defaults={'total_hours': total_hours}
        )
        
        if not created:
            coverage.total_hours = total_hours
        
        coverage.check_exceeds_limit(max_hours)
        coverage.save()
        
        return coverage
    
    return None


def get_monday_of_week(date):
    """
    Get the Monday of the week for a given date.
    
    Args:
        date: datetime.date
    
    Returns:
        datetime.date (Monday)
    """
    return date - timedelta(days=date.weekday())


def update_coverage_for_shift(shift):
    """
    Update both critical time coverage and weekly hours when a shift changes.
    
    Args:
        shift: ShiftRequest instance
    """
    calculate_critical_coverage(shift.date)
    
    week_start = get_monday_of_week(shift.date)
    calculate_weekly_hours(shift.requested_by, week_start)