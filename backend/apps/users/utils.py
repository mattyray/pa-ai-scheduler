from datetime import timedelta
from django.db.models import Count, Avg, Sum
from django.utils import timezone
from apps.shifts.models import ShiftRequest
from .models import PAScheduleStats


def calculate_pa_patterns(pa_id):
    """
    Calculate and update scheduling patterns for a PA user.
    Analyzes last 12 weeks of shift data.
    
    Args:
        pa_id: User ID of the PA
    
    Returns:
        PAScheduleStats instance
    """
    from apps.users.models import User, PAScheduleStats
    
    try:
        pa = User.objects.get(id=pa_id, role='PA')
    except User.DoesNotExist:
        return None
    
    # Get or create stats object
    stats, created = PAScheduleStats.objects.get_or_create(pa=pa)
    
    # Calculate date range (last 12 weeks)
    end_date = timezone.now().date()
    start_date = end_date - timedelta(weeks=12)
    
    # Get all approved shifts in date range
    shifts = ShiftRequest.objects.filter(
        requested_by=pa,
        status='APPROVED',
        date__gte=start_date,
        date__lte=end_date
    )
    
    # Lifetime statistics
    all_shifts = ShiftRequest.objects.filter(
        requested_by=pa,
        status='APPROVED'
    )
    
    stats.total_shifts_worked = all_shifts.count()
    stats.total_hours_worked = all_shifts.aggregate(
        total=Sum('duration_hours')
    )['total'] or 0
    
    # Average hours per week (last 12 weeks)
    if shifts.exists():
        total_hours_12_weeks = shifts.aggregate(
            total=Sum('duration_hours')
        )['total'] or 0
        stats.average_hours_per_week = total_hours_12_weeks / 12
    
    # Most common days
    day_counts = {}
    for shift in shifts:
        day_name = shift.date.strftime('%A').lower()
        day_counts[day_name] = day_counts.get(day_name, 0) + 1
    stats.most_common_days = day_counts
    
    # Most common start time
    if shifts.exists():
        start_times = shifts.values('start_time').annotate(
            count=Count('start_time')
        ).order_by('-count').first()
        
        if start_times:
            stats.most_common_start_time = start_times['start_time']
    
    # Most common shift length
    if shifts.exists():
        avg_length = shifts.aggregate(
            avg_duration=Avg('duration_hours')
        )['avg_duration']
        stats.most_common_shift_length = avg_length
    
    # Preferred shift pattern (morning/evening/full_day/mixed)
    morning_shifts = shifts.filter(start_time__hour__lt=12).count()
    evening_shifts = shifts.filter(start_time__hour__gte=18).count()
    total_shifts_counted = shifts.count()
    
    if total_shifts_counted > 0:
        morning_ratio = morning_shifts / total_shifts_counted
        evening_ratio = evening_shifts / total_shifts_counted
        
        if morning_ratio > 0.6:
            stats.preferred_shift_pattern = 'morning'
        elif evening_ratio > 0.6:
            stats.preferred_shift_pattern = 'evening'
        elif morning_ratio > 0.3 and evening_ratio > 0.3:
            stats.preferred_shift_pattern = 'full_day'
        else:
            stats.preferred_shift_pattern = 'mixed'
    
    # Reliability score (% of approved shifts not cancelled)
    total_requested = ShiftRequest.objects.filter(requested_by=pa).count()
    cancelled = ShiftRequest.objects.filter(
        requested_by=pa,
        status='CANCELLED'
    ).count()
    
    if total_requested > 0:
        stats.reliability_score = ((total_requested - cancelled) / total_requested) * 100
    
    # Typical request timing (days before shift)
    if shifts.exists():
        timing_diffs = []
        for shift in shifts[:50]:  # Sample last 50 shifts
            days_before = (shift.date - shift.created_at.date()).days
            if days_before >= 0:
                timing_diffs.append(days_before)
        
        if timing_diffs:
            stats.typical_request_timing = sum(timing_diffs) // len(timing_diffs)
    
    # Consecutive days preference
    if shifts.exists():
        dates = sorted([shift.date for shift in shifts])
        consecutive_counts = []
        current_streak = 1
        
        for i in range(1, len(dates)):
            if (dates[i] - dates[i-1]).days == 1:
                current_streak += 1
            else:
                if current_streak > 1:
                    consecutive_counts.append(current_streak)
                current_streak = 1
        
        if consecutive_counts:
            stats.consecutive_days_preference = sum(consecutive_counts) // len(consecutive_counts)
    
    # Last worked date
    if all_shifts.exists():
        stats.last_worked_date = all_shifts.latest('date').date
    
    stats.save()
    return stats