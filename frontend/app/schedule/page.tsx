'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI, SchedulePeriod } from '@/lib/schedules-api';
import { getPAColor, getPAColorLight, getPAColorDark, isOvernightShift } from '@/lib/pa-colors';

type ViewType = 'month' | 'week' | 'day';

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [viewType, setViewType] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadPeriods();
    }
  }, [user]);

  useEffect(() => {
    const periodId = searchParams.get('period');
    if (periodId) {
      setSelectedPeriod(parseInt(periodId));
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedPeriod) {
      loadCalendarData();
    }
  }, [selectedPeriod, viewType, currentDate]);

  const loadPeriods = async () => {
    try {
      const response = await schedulesAPI.listPeriods();
      const periodsData = response.data.results || response.data;
      setPeriods(Array.isArray(periodsData) ? periodsData : []);
      
      if (!selectedPeriod && Array.isArray(periodsData) && periodsData.length > 0) {
        const openPeriod = periodsData.find(p => p.status === 'OPEN');
        setSelectedPeriod(openPeriod?.id || periodsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarData = async () => {
    if (!selectedPeriod) return;

    try {
      setLoading(true);
      let response;

      if (viewType === 'month') {
        response = await schedulesAPI.getMonthView(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1
        );
      } else if (viewType === 'week') {
        const weekNum = getWeekNumber(currentDate);
        response = await schedulesAPI.getWeekView(
          currentDate.getFullYear(),
          weekNum
        );
      } else {
        const dateStr = currentDate.toISOString().split('T')[0];
        response = await schedulesAPI.getDayView(dateStr);
      }

      setCalendarData(response.data);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Get week date range for display
  const getWeekDateRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    
    const sunday = new Date(d.setDate(diff));
    const saturday = new Date(d.setDate(diff + 6));
    
    const format = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    if (sunday.getMonth() === saturday.getMonth()) {
      return `${format(sunday)} - ${saturday.getDate()}, ${sunday.getFullYear()}`;
    } else {
      return `${format(sunday)} - ${format(saturday)}, ${sunday.getFullYear()}`;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDateTitle = () => {
    if (viewType === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewType === 'week') {
      return getWeekDateRange(currentDate);
    } else {
      return currentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  };

  const handleDayClick = (date: string) => {
    const clickedDate = new Date(date);
    setCurrentDate(clickedDate);
    
    if (viewType === 'month') {
      setViewType('week');
    } else if (viewType === 'week') {
      setViewType('day');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(user?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-gray-900">Schedule</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Controls Bar */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Period Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-900">Period:</label>
                <select
                  value={selectedPeriod || ''}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-gray-900"
                >
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({period.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* View Type Selector */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewType('month')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    viewType === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewType('week')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    viewType === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewType('day')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    viewType === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Day
                </button>
              </div>

              {/* Date Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevious}
                  className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Today
                </button>
                <button
                  onClick={goToNext}
                  className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Current Date Display */}
            <div className="mt-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">{getDateTitle()}</h2>
            </div>
          </div>

          {/* Calendar Display */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">Loading calendar...</p>
              </div>
            ) : !calendarData ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No data available</p>
              </div>
            ) : viewType === 'month' ? (
              <MonthView data={calendarData} onDayClick={handleDayClick} />
            ) : viewType === 'week' ? (
              <WeekView data={calendarData} onDayClick={handleDayClick} />
            ) : (
              <DayView data={calendarData} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper function to convert 24-hour to 12-hour format
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Month View Component - IMPROVED
function MonthView({ data, onDayClick }: { data: any; onDayClick: (date: string) => void }) {
  const getCoverageIndicator = (coverage: any) => {
    if (!coverage) return '❌';
    if (coverage.morning_covered && coverage.evening_covered) return '✅';
    if (coverage.morning_covered || coverage.evening_covered) return '⚠️';
    return '❌';
  };

  const getCoverageColor = (coverage: any) => {
    if (!coverage) return 'bg-white border-gray-200';
    if (coverage.morning_covered && coverage.evening_covered) return 'bg-green-50 border-green-300';
    if (coverage.morning_covered || coverage.evening_covered) return 'bg-yellow-50 border-yellow-300';
    return 'bg-red-50 border-red-300';
  };

  return (
    <div className="p-4">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-gray-700 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {data.weeks?.map((week: any, weekIdx: number) =>
          week.days?.map((day: any, dayIdx: number) => {
            const date = new Date(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            const coverageColor = getCoverageColor(day.coverage);
            const coverageIndicator = getCoverageIndicator(day.coverage);

            // Get unique PAs for this day
            const uniquePAs = Array.from(new Set(day.shifts?.map((s: any) => s.requested_by) || []));
            const shiftCount = day.shifts?.length || 0;

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => onDayClick(day.date)}
                className={`min-h-28 border-2 rounded-lg p-2 cursor-pointer hover:shadow-lg transition-all ${coverageColor} ${
                  !day.is_current_month ? 'opacity-40' : ''
                } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* Date and Coverage Indicator */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  <span className="text-xl">{coverageIndicator}</span>
                </div>

                {/* PA Dots */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {uniquePAs.slice(0, 3).map((paId: any, idx: number) => (
                    <div
                      key={idx}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getPAColor(paId) }}
                      title={`PA ${paId}`}
                    />
                  ))}
                  {uniquePAs.length > 3 && (
                    <span className="text-xs text-gray-600 font-medium">+{uniquePAs.length - 3}</span>
                  )}
                </div>

                {/* Shift Count */}
                {shiftCount > 0 && (
                  <div className="text-xs text-gray-600 font-medium">
                    {shiftCount} shift{shiftCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✅</span>
          <span>Both critical times covered</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xl">⚠️</span>
          <span>Partial coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xl">❌</span>
          <span>No critical coverage</span>
        </div>
      </div>
    </div>
  );
}

// Week View Component - PLACEHOLDER (will improve in Phase 3)
function WeekView({ data, onDayClick }: { data: any; onDayClick: (date: string) => void }) {
  const getCoverageColor = (coverage: any) => {
    if (!coverage) return 'bg-white';
    if (coverage.morning_covered && coverage.evening_covered) return 'bg-green-50';
    if (coverage.morning_covered || coverage.evening_covered) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-3">
        {data.days?.map((day: any) => {
          const date = new Date(day.date);
          const isToday = date.toDateString() === new Date().toDateString();
          const bgColor = getCoverageColor(day.coverage);

          return (
            <div 
              key={day.date} 
              onClick={() => onDayClick(day.date)}
              className={`border-2 rounded-lg p-3 cursor-pointer hover:shadow-lg transition-all ${bgColor} ${
                isToday ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-300'
              }`}
            >
              <div className="font-semibold text-center mb-2 text-gray-900">
                {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
              </div>
              
              {/* Coverage indicators */}
              {day.coverage && (
                <div className="flex justify-center space-x-2 mb-2 text-xs">
                  {day.coverage.morning_covered && <span>🌅</span>}
                  {day.coverage.evening_covered && <span>🌙</span>}
                </div>
              )}

              <div className="space-y-2">
                {day.shifts?.length === 0 ? (
                  <p className="text-xs text-center text-gray-400">No shifts</p>
                ) : (
                  day.shifts?.map((shift: any) => (
                    <div
                      key={shift.id}
                      className="text-xs rounded px-2 py-1.5 text-white"
                      style={{ backgroundColor: getPAColor(shift.requested_by) }}
                      title={`${shift.pa_name}: ${formatTime12Hour(shift.start_time)} - ${formatTime12Hour(shift.end_time)}`}
                    >
                      <div className="font-semibold truncate">{shift.pa_name}</div>
                      <div className="text-[10px] opacity-90">
                        {formatTime12Hour(shift.start_time)}
                      </div>
                      <div className="text-[10px] opacity-90">
                        {formatTime12Hour(shift.end_time)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total hours */}
              {day.total_hours > 0 && (
                <div className="mt-2 text-xs text-center text-gray-600 font-medium">
                  {day.total_hours}h total
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day View Component - PLACEHOLDER (will improve in Phase 3)
function DayView({ data }: { data: any }) {
  return (
    <div className="p-4">
      <div className="mb-4 pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">{data.day_name}</h3>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
          <span>Morning (6-9 AM): {data.coverage?.morning_covered ? '✅ Covered' : '❌ Not Covered'}</span>
          <span>Evening (9-10 PM): {data.coverage?.evening_covered ? '✅ Covered' : '❌ Not Covered'}</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.shifts?.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-gray-500">No shifts scheduled for this day</p>
          </div>
        ) : (
          data.shifts?.map((shift: any) => {
            const paColor = getPAColor(shift.requested_by);
            const paColorLight = getPAColorLight(shift.requested_by);
            
            return (
              <div
                key={shift.id}
                className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow"
                style={{ 
                  backgroundColor: paColorLight,
                  borderColor: paColor 
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-gray-900">{shift.pa_name}</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Time:</span> {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Duration:</span> {shift.duration_hours} hours
                      </p>
                      {shift.notes && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Notes:</span> {shift.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    shift.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {shift.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
