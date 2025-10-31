from datetime import datetime, timedelta, time
from calendar import monthrange
from apps.shifts.models import ShiftRequest
from apps.coverage.models import CriticalTimeCoverage


def get_coverage_for_date(date):
    """
    Get coverage status for a specific date.
    Returns dict with morning_covered, evening_covered, and coverage_status.
    """
    try:
        coverage = CriticalTimeCoverage.objects.get(date=date)
        return {
            'morning_covered': coverage.morning_covered,
            'evening_covered': coverage.evening_covered,
            'coverage_status': coverage.coverage_status,
        }
    except CriticalTimeCoverage.DoesNotExist:
        # Check shifts for this date to determine coverage
        shifts = ShiftRequest.objects.filter(
            date=date,
            status='APPROVED'
        )
        
        morning_covered = False
        evening_covered = False
        
        for shift in shifts:
            # Morning: 6:00 AM - 9:00 AM (must cover full 3 hours)
            if shift.start_time <= time(6, 0) and shift.end_time >= time(9, 0):
                morning_covered = True
            
            # Evening: 9:00 PM - 10:00 PM (must cover full 1 hour)
            if shift.start_time <= time(21, 0) and shift.end_time >= time(22, 0):
                evening_covered = True
        
        if morning_covered and evening_covered:
            status = 'complete'
        elif morning_covered or evening_covered:
            status = 'partial'
        else:
            status = 'none'
        
        return {
            'morning_covered': morning_covered,
            'evening_covered': evening_covered,
            'coverage_status': status,
        }


def get_shifts_for_date(date):
    """Get all approved shifts for a specific date"""
    return ShiftRequest.objects.filter(
        date=date,
        status='APPROVED'
    ).select_related('requested_by').order_by('start_time')


def get_month_data(year, month):
    """
    Get calendar data for an entire month.
    Returns dict with all days and their shifts/coverage.
    """
    # Get first and last day of month
    _, last_day = monthrange(year, month)
    start_date = datetime(year, month, 1).date()
    end_date = datetime(year, month, last_day).date()
    
    # Get all shifts for the month
    shifts = ShiftRequest.objects.filter(
        date__gte=start_date,
        date__lte=end_date,
        status='APPROVED'
    ).select_related('requested_by').order_by('date', 'start_time')
    
    # Organize shifts by date
    shifts_by_date = {}
    for shift in shifts:
        if shift.date not in shifts_by_date:
            shifts_by_date[shift.date] = []
        shifts_by_date[shift.date].append(shift)
    
    # Build day-by-day data
    days = []
    current_date = start_date
    
    while current_date <= end_date:
        coverage = get_coverage_for_date(current_date)
        day_shifts = shifts_by_date.get(current_date, [])
        
        days.append({
            'date': current_date,
            'morning_covered': coverage['morning_covered'],
            'evening_covered': coverage['evening_covered'],
            'coverage_status': coverage['coverage_status'],
            'shifts': day_shifts,
        })
        
        current_date += timedelta(days=1)
    
    # Coverage summary
    total_days = len(days)
    complete_days = sum(1 for d in days if d['coverage_status'] == 'complete')
    partial_days = sum(1 for d in days if d['coverage_status'] == 'partial')
    no_coverage_days = sum(1 for d in days if d['coverage_status'] == 'none')
    
    return {
        'year': year,
        'month': month,
        'month_name': start_date.strftime('%B %Y'),
        'days': days,
        'total_shifts': len(shifts),
        'coverage_summary': {
            'total_days': total_days,
            'complete_coverage': complete_days,
            'partial_coverage': partial_days,
            'no_coverage': no_coverage_days,
        }
    }


def get_week_data(year, week_number):
    """
    Get calendar data for a specific week.
    Week starts on Monday (ISO week).
    """
    # Get the Monday of the specified week
    jan_4 = datetime(year, 1, 4)
    week_start = jan_4 - timedelta(days=jan_4.weekday()) + timedelta(weeks=week_number - 1)
    week_start = week_start.date()
    week_end = week_start + timedelta(days=6)
    
    # Get all shifts for the week
    shifts = ShiftRequest.objects.filter(
        date__gte=week_start,
        date__lte=week_end,
        status='APPROVED'
    ).select_related('requested_by').order_by('date', 'start_time')
    
    # Organize shifts by date
    shifts_by_date = {}
    for shift in shifts:
        if shift.date not in shifts_by_date:
            shifts_by_date[shift.date] = []
        shifts_by_date[shift.date].append(shift)
    
    # Build day-by-day data for the week
    days = []
    current_date = week_start
    
    for _ in range(7):
        coverage = get_coverage_for_date(current_date)
        day_shifts = shifts_by_date.get(current_date, [])
        
        days.append({
            'date': current_date,
            'morning_covered': coverage['morning_covered'],
            'evening_covered': coverage['evening_covered'],
            'coverage_status': coverage['coverage_status'],
            'shifts': day_shifts,
        })
        
        current_date += timedelta(days=1)
    
    return {
        'year': year,
        'week_number': week_number,
        'week_start': week_start,
        'week_end': week_end,
        'days': days,
        'total_shifts': len(shifts),
    }


def get_day_data(date):
    """
    Get detailed data for a single day including hourly timeline.
    """
    coverage = get_coverage_for_date(date)
    shifts = get_shifts_for_date(date)
    
    # Create hourly timeline (6 AM to 11 PM)
    hourly_timeline = {}
    for hour in range(6, 23):
        hour_start = time(hour, 0)
        hour_end = time(hour + 1, 0) if hour < 23 else time(23, 59)
        
        # Find shifts covering this hour
        covering_shifts = []
        for shift in shifts:
            if shift.start_time <= hour_start and shift.end_time >= hour_end:
                covering_shifts.append({
                    'id': shift.id,
                    'pa_name': shift.requested_by.get_full_name(),
                    'pa_id': shift.requested_by.id,
                })
        
        hourly_timeline[f"{hour:02d}:00"] = covering_shifts
    
    return {
        'date': date,
        'day_name': date.strftime('%A, %B %d, %Y'),
        'morning_covered': coverage['morning_covered'],
        'evening_covered': coverage['evening_covered'],
        'coverage_status': coverage['coverage_status'],
        'shifts': shifts,
        'hourly_timeline': hourly_timeline,
    }