from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Q
from datetime import datetime, timedelta
from calendar import monthrange
from .models import SchedulePeriod
from apps.shifts.models import ShiftRequest
from apps.coverage.models import CriticalTimeCoverage
from .serializers import (
    SchedulePeriodSerializer,
    SchedulePeriodDetailSerializer,
    SchedulePeriodCreateUpdateSerializer,
    CalendarShiftSerializer,
    DayScheduleSerializer,
    WeekScheduleSerializer,
    MonthScheduleSerializer
)


class IsAdminUser(permissions.BasePermission):
    """Custom permission: only admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'ADMIN'


class SchedulePeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Schedule Periods
    
    List: GET /api/schedule-periods/ (all users)
    Retrieve: GET /api/schedule-periods/{id}/ (all users)
    Create: POST /api/schedule-periods/ (admin only)
    Update: PUT/PATCH /api/schedule-periods/{id}/ (admin only)
    Delete: DELETE /api/schedule-periods/{id}/ (admin only)
    Finalize: POST /api/schedule-periods/{id}/finalize/ (admin only)
    """
    queryset = SchedulePeriod.objects.all().order_by('-start_date')
    
    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'retrieve':
            return SchedulePeriodDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SchedulePeriodCreateUpdateSerializer
        return SchedulePeriodSerializer
    
    def get_permissions(self):
        """Admin only for create/update/delete"""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'finalize']:
            return [IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Set created_by to current user"""
        serializer.save(created_by=self.request.user)
        
    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """
        Finalize a schedule period (admin only)
        Shows coverage warnings but does NOT block finalization.
        """
        period = self.get_object()
        
        if period.status == 'FINALIZED':
            return Response(
                {'error': 'This period is already finalized.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.coverage.models import CriticalTimeCoverage
        from datetime import timedelta
        
        coverage_warnings = []
        current_date = period.start_date
        
        while current_date <= period.end_date:
            try:
                coverage = CriticalTimeCoverage.objects.get(date=current_date)
                if not coverage.morning_covered:
                    coverage_warnings.append(f"{current_date.strftime('%b %d')}: Morning (6-9 AM) not covered")
                if not coverage.evening_covered:
                    coverage_warnings.append(f"{current_date.strftime('%b %d')}: Evening (9-10 PM) not covered")
            except CriticalTimeCoverage.DoesNotExist:
                coverage_warnings.append(f"{current_date.strftime('%b %d')}: No coverage at all")
            
            current_date += timedelta(days=1)
        
        period.status = 'FINALIZED'
        period.save()
        
        from apps.shifts.models import ShiftRequest
        pending = ShiftRequest.objects.filter(
            schedule_period=period,
            status='PENDING'
        )
        rejected_count = pending.count()
        pending.update(
            status='REJECTED',
            rejected_reason='Schedule period has been finalized'
        )
        
        from apps.users.models import User
        pa_emails = list(User.objects.filter(role='PA', is_active=True).values_list('email', flat=True))
        
        from apps.schedules.websocket_utils import broadcast_period_finalized
        broadcast_period_finalized(period, message=f'{period.name} has been finalized')
        
        response_data = {
            'message': f'Schedule period "{period.name}" finalized successfully.',
            'period': SchedulePeriodSerializer(period).data,
            'rejected_requests': rejected_count,
        }
        
        if coverage_warnings:
            response_data['coverage_warnings'] = coverage_warnings
            response_data['warning_count'] = len(coverage_warnings)
        else:
            response_data['coverage_status'] = 'All critical times covered! ✅'
        
        return Response(response_data, status=status.HTTP_200_OK)


class MonthViewAPI(APIView):
    """
    GET /api/calendar/month/{year}/{month}/
    Returns approved AND pending shifts for a given month in calendar format
    Weeks start on Sunday
    
    Query params:
    - pa_id: Filter by specific PA
    - status: Filter by status (APPROVED, PENDING, etc.) - defaults to both APPROVED and PENDING
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, year, month):
        """Get month view data with both approved and pending shifts"""
        try:
            year = int(year)
            month = int(month)
            
            if not (1 <= month <= 12):
                return Response(
                    {'error': 'Month must be between 1 and 12'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            first_day = datetime(year, month, 1).date()
            last_day = datetime(year, month, monthrange(year, month)[1]).date()
            
            status_filter = request.query_params.get('status')
            
            if status_filter:
                shifts = ShiftRequest.objects.filter(
                    date__gte=first_day,
                    date__lte=last_day,
                    status=status_filter.upper()
                )
            else:
                shifts = ShiftRequest.objects.filter(
                    date__gte=first_day,
                    date__lte=last_day,
                    status__in=['APPROVED', 'PENDING']
                )
            
            shifts = shifts.select_related('requested_by', 'schedule_period').order_by('date', 'start_time')
            
            pa_id = request.query_params.get('pa_id')
            if pa_id:
                try:
                    pa_id = int(pa_id)
                    shifts = shifts.filter(requested_by_id=pa_id)
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'Invalid pa_id parameter'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            weeks = []
            current_date = first_day
            
            # Go back to Sunday (weekday 6 in Python, where Monday=0)
            while current_date.weekday() != 6:
                current_date -= timedelta(days=1)
            
            week_number = 1
            while current_date <= last_day or current_date.month == month:
                week_start = current_date
                week_end = current_date + timedelta(days=6)
                
                days = []
                for day_offset in range(7):
                    day_date = week_start + timedelta(days=day_offset)
                    
                    day_shifts = [s for s in shifts if s.date == day_date]
                    
                    coverage = self._get_day_coverage(day_date)
                    
                    total_hours = sum(s.duration_hours for s in day_shifts)
                    
                    days.append({
                        'date': day_date.isoformat(),
                        'day_name': day_date.strftime('%A'),
                        'shifts': CalendarShiftSerializer(day_shifts, many=True).data,
                        'coverage': coverage,
                        'total_hours': float(total_hours),
                        'is_current_month': day_date.month == month
                    })
                
                weeks.append({
                    'week_start': week_start.isoformat(),
                    'week_end': week_end.isoformat(),
                    'week_number': week_number,
                    'days': days
                })
                
                current_date = week_end + timedelta(days=1)
                week_number += 1
                
                if week_number > 6:
                    break
            
            coverage_stats = self._get_month_coverage_stats(first_day, last_day)
            
            response_data = {
                'year': year,
                'month': month,
                'month_name': first_day.strftime('%B %Y'),
                'weeks': weeks,
                'total_shifts': shifts.count(),
                'coverage_stats': coverage_stats
            }
            
            return Response(response_data)
            
        except ValueError:
            return Response(
                {'error': 'Invalid year or month'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _get_day_coverage(self, date):
        """Get coverage status for a specific day"""
        try:
            coverage = CriticalTimeCoverage.objects.get(date=date)
            
            # Calculate status based on coverage
            if coverage.morning_covered and coverage.evening_covered:
                coverage_status = 'full'
            elif coverage.morning_covered or coverage.evening_covered:
                coverage_status = 'partial'
            else:
                coverage_status = 'none'
            
            return {
                'morning_covered': coverage.morning_covered,
                'evening_covered': coverage.evening_covered,
                'status': coverage_status
            }
        except CriticalTimeCoverage.DoesNotExist:
            return {
                'morning_covered': False,
                'evening_covered': False,
                'status': 'none'
            }
    
    def _get_month_coverage_stats(self, start_date, end_date):
        """Calculate coverage statistics for the month"""
        total_days = (end_date - start_date).days + 1
        
        # Count days where either morning OR evening is covered
        covered_days = CriticalTimeCoverage.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).filter(
            Q(morning_covered=True) | Q(evening_covered=True)
        ).count()
        
        return {
            'total_days': total_days,
            'covered_days': covered_days,
            'coverage_percentage': (covered_days / total_days * 100) if total_days > 0 else 0
        }


class WeekViewAPI(APIView):
    """
    GET /api/calendar/week/{year}/{week}/
    Returns approved AND pending shifts for a given week (Sunday-based week number)
    
    Query params:
    - pa_id: Filter by specific PA
    - status: Filter by status (APPROVED, PENDING, etc.) - defaults to both APPROVED and PENDING
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, year, week):
        """Get week view data with both approved and pending shifts"""
        try:
            year = int(year)
            week = int(week)
            
            if not (1 <= week <= 53):
                return Response(
                    {'error': 'Week must be between 1 and 53'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate Sunday-based week
            jan_1 = datetime(year, 1, 1).date()
            days_since_sunday = (jan_1.weekday() + 1) % 7
            first_week_start = jan_1 - timedelta(days=days_since_sunday)
            
            week_start = first_week_start + timedelta(weeks=week - 1)
            week_end = week_start + timedelta(days=6)
            
            status_filter = request.query_params.get('status')
            
            if status_filter:
                shifts = ShiftRequest.objects.filter(
                    date__gte=week_start,
                    date__lte=week_end,
                    status=status_filter.upper()
                )
            else:
                shifts = ShiftRequest.objects.filter(
                    date__gte=week_start,
                    date__lte=week_end,
                    status__in=['APPROVED', 'PENDING']
                )
            
            shifts = shifts.select_related('requested_by', 'schedule_period').order_by('date', 'start_time')
            
            pa_id = request.query_params.get('pa_id')
            if pa_id:
                try:
                    pa_id = int(pa_id)
                    shifts = shifts.filter(requested_by_id=pa_id)
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'Invalid pa_id parameter'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            days = []
            for day_offset in range(7):
                day_date = week_start + timedelta(days=day_offset)
                
                day_shifts = [s for s in shifts if s.date == day_date]
                
                coverage = self._get_day_coverage(day_date)
                
                total_hours = sum(s.duration_hours for s in day_shifts)
                
                days.append({
                    'date': day_date.isoformat(),
                    'day_name': day_date.strftime('%A'),
                    'shifts': CalendarShiftSerializer(day_shifts, many=True).data,
                    'coverage': coverage,
                    'total_hours': float(total_hours)
                })
            
            response_data = {
                'week_start': week_start.isoformat(),
                'week_end': week_end.isoformat(),
                'week_number': week,
                'year': year,
                'days': days,
                'total_shifts': shifts.count()
            }
            
            return Response(response_data)
            
        except ValueError:
            return Response(
                {'error': 'Invalid year or week'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _get_day_coverage(self, date):
        """Get coverage status for a specific day"""
        try:
            coverage = CriticalTimeCoverage.objects.get(date=date)
            
            # Calculate status based on coverage
            if coverage.morning_covered and coverage.evening_covered:
                coverage_status = 'full'
            elif coverage.morning_covered or coverage.evening_covered:
                coverage_status = 'partial'
            else:
                coverage_status = 'none'
            
            return {
                'morning_covered': coverage.morning_covered,
                'evening_covered': coverage.evening_covered,
                'status': coverage_status
            }
        except CriticalTimeCoverage.DoesNotExist:
            return {
                'morning_covered': False,
                'evening_covered': False,
                'status': 'none'
            }


class DayViewAPI(APIView):
    """
    GET /api/calendar/day/{date}/
    Returns approved AND pending shifts for a specific day with hourly breakdown
    Date format: YYYY-MM-DD
    
    Query params:
    - pa_id: Filter by specific PA
    - status: Filter by status (APPROVED, PENDING, etc.) - defaults to both APPROVED and PENDING
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, date):
        """Get day view data with both approved and pending shifts"""
        try:
            day_date = datetime.strptime(date, '%Y-%m-%d').date()
            
            status_filter = request.query_params.get('status')
            
            if status_filter:
                shifts = ShiftRequest.objects.filter(
                    date=day_date,
                    status=status_filter.upper()
                )
            else:
                shifts = ShiftRequest.objects.filter(
                    date=day_date,
                    status__in=['APPROVED', 'PENDING']
                )
            
            shifts = shifts.select_related('requested_by', 'schedule_period').order_by('start_time')
            
            pa_id = request.query_params.get('pa_id')
            if pa_id:
                try:
                    pa_id = int(pa_id)
                    shifts = shifts.filter(requested_by_id=pa_id)
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'Invalid pa_id parameter'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            try:
                coverage = CriticalTimeCoverage.objects.get(date=day_date)
                
                # Calculate status
                if coverage.morning_covered and coverage.evening_covered:
                    coverage_status = 'full'
                elif coverage.morning_covered or coverage.evening_covered:
                    coverage_status = 'partial'
                else:
                    coverage_status = 'none'
                
                coverage_data = {
                    'morning_covered': coverage.morning_covered,
                    'evening_covered': coverage.evening_covered,
                    'morning_shift': CalendarShiftSerializer(coverage.morning_shift).data if coverage.morning_shift else None,
                    'evening_shift': CalendarShiftSerializer(coverage.evening_shift).data if coverage.evening_shift else None,
                    'status': coverage_status
                }
            except CriticalTimeCoverage.DoesNotExist:
                coverage_data = {
                    'morning_covered': False,
                    'evening_covered': False,
                    'morning_shift': None,
                    'evening_shift': None,
                    'status': 'none'
                }
            
            total_hours = sum(s.duration_hours for s in shifts)
            
            timeline = []
            for hour in range(24):
                hour_shifts = [
                    s for s in shifts 
                    if s.start_time.hour <= hour < s.end_time.hour or
                    (s.start_time.hour > s.end_time.hour and (hour >= s.start_time.hour or hour < s.end_time.hour))
                ]
                
                timeline.append({
                    'hour': hour,
                    'hour_label': f'{hour:02d}:00',
                    'shifts': CalendarShiftSerializer(hour_shifts, many=True).data,
                    'is_critical_time': (6 <= hour < 9) or (21 <= hour < 22)
                })
            
            response_data = {
                'date': day_date,
                'day_name': day_date.strftime('%A, %B %d, %Y'),
                'shifts': CalendarShiftSerializer(shifts, many=True).data,
                'coverage': coverage_data,
                'total_hours': total_hours,
                'timeline': timeline
            }
            
            return Response(response_data)
            
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )