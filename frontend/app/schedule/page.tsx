'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI, SchedulePeriod } from '@/lib/schedules-api';

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
    // Check for period in URL
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
      
      // Auto-select first OPEN period
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
      return `Week ${getWeekNumber(currentDate)}, ${currentDate.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
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
                <label className="text-sm font-medium text-gray-700">Period:</label>
                <select
                  value={selectedPeriod || ''}
                  onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
              <MonthView data={calendarData} />
            ) : viewType === 'week' ? (
              <WeekView data={calendarData} />
            ) : (
              <DayView data={calendarData} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Month View Component
function MonthView({ data }: { data: any }) {
  const getCoverageColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 border-green-300';
      case 'partial':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-red-100 border-red-300';
    }
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
            const coverageColor = getCoverageColor(day.coverage?.status || 'none');

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                className={`min-h-24 border-2 rounded-lg p-2 ${coverageColor} ${
                  !day.is_current_month ? 'opacity-40' : ''
                } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {day.coverage && (
                    <div className="flex space-x-1">
                      {day.coverage.morning_covered && (
                        <span className="text-xs">🌅</span>
                      )}
                      {day.coverage.evening_covered && (
                        <span className="text-xs">🌙</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {day.shifts?.slice(0, 2).map((shift: any) => (
                    <div
                      key={shift.id}
                      className="text-xs bg-blue-500 text-white rounded px-1 py-0.5 truncate"
                      title={`${shift.pa_name}: ${shift.start_time} - ${shift.end_time}`}
                    >
                      {shift.pa_name}
                    </div>
                  ))}
                  {day.shifts?.length > 2 && (
                    <div className="text-xs text-gray-600">
                      +{day.shifts.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
          <span>Full Coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
          <span>Partial Coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
          <span>No Coverage</span>
        </div>
      </div>
    </div>
  );
}

// Week View Component (simplified)
function WeekView({ data }: { data: any }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-2">
        {data.days?.map((day: any) => (
          <div key={day.date} className="border rounded-lg p-2">
            <div className="font-semibold text-center mb-2">
              {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
            </div>
            <div className="space-y-1">
              {day.shifts?.map((shift: any) => (
                <div
                  key={shift.id}
                  className="text-xs bg-blue-500 text-white rounded px-2 py-1"
                  title={`${shift.pa_name}: ${shift.start_time} - ${shift.end_time}`}
                >
                  <div className="font-semibold truncate">{shift.pa_name}</div>
                  <div>{shift.start_time} - {shift.end_time}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Day View Component (simplified)
function DayView({ data }: { data: any }) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{data.day_name}</h3>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
          <span>Morning: {data.coverage?.morning_covered ? '✅' : '❌'}</span>
          <span>Evening: {data.coverage?.evening_covered ? '✅' : '❌'}</span>
        </div>
      </div>

      <div className="space-y-2">
        {data.shifts?.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No shifts scheduled</p>
        ) : (
          data.shifts?.map((shift: any) => (
            <div
              key={shift.id}
              className="border border-gray-300 rounded-lg p-4 bg-blue-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{shift.pa_name}</h4>
                  <p className="text-sm text-gray-600">
                    {shift.start_time} - {shift.end_time} ({shift.duration_hours} hours)
                  </p>
                  {shift.notes && (
                    <p className="text-sm text-gray-500 mt-1">{shift.notes}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  shift.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {shift.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
