'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI } from '@/lib/schedules-api';
import { getPAColor } from '@/lib/pa-colors';
import SuggestShiftModal from '@/app/admin/dashboard/SuggestShiftModal';

export default function SchedulePage() {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestModalDefaults, setSuggestModalDefaults] = useState({
    date: '',
    startTime: '06:00',
    endTime: '09:00',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user) {
      loadPeriods();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (selectedPeriod) {
      loadCalendarData();
    }
  }, [selectedPeriod, currentDate, viewType]);

  const loadPeriods = async () => {
    try {
      console.log('Loading periods...');
      const response = await schedulesAPI.listPeriods();
      const periodsData = response.data;
      console.log('Periods loaded:', periodsData);
      setPeriods(periodsData);
      
      if (periodsData.length > 0) {
        const openPeriod = periodsData.find((p: any) => p.status === 'OPEN');
        const periodToSelect = openPeriod?.id || periodsData[0].id;
        console.log('Selecting period:', periodToSelect);
        setSelectedPeriod(periodToSelect);
      } else {
        setError('No schedule periods available');
      }
    } catch (error: any) {
      console.error('Failed to load periods:', error);
      setError('Failed to load schedule periods');
    }
  };

  const loadCalendarData = async () => {
    if (!selectedPeriod) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading calendar data...', { viewType, selectedPeriod, currentDate });
      let response;
      
      if (viewType === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        console.log('Fetching month view:', { year, month, selectedPeriod });
        response = await schedulesAPI.getMonthView(selectedPeriod, year, month);
      } else if (viewType === 'week') {
        const weekStart = getWeekStart(currentDate);
        console.log('Fetching week view:', { weekStart, selectedPeriod });
        response = await schedulesAPI.getWeekView(weekStart as any, selectedPeriod as any);
      } else {
        const dateStr = currentDate.toISOString().split('T')[0];
        console.log('Fetching day view:', { dateStr, selectedPeriod });
        response = await schedulesAPI.getDayView(dateStr as any, selectedPeriod as any);
      }
      
      console.log('Calendar data loaded:', response.data);
      setCalendarData(response.data);
    } catch (error: any) {
      console.error('Failed to load calendar data:', error);
      console.error('Error details:', error.response?.data);
      setError('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateTitle = (): string => {
    if (viewType === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewType === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const handleDayClick = (date: string) => {
    setCurrentDate(new Date(date));
    setViewType('day');
  };

  const openSuggestModal = (date?: string, startTime?: string, endTime?: string) => {
    setSuggestModalDefaults({
      date: date || currentDate.toISOString().split('T')[0],
      startTime: startTime || '06:00',
      endTime: endTime || '09:00',
    });
    setSuggestModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadPeriods();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(user?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Schedule</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 hidden sm:inline">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Period:</label>
              <select
                value={selectedPeriod || ''}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewType('month')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  viewType === 'month'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewType('week')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  viewType === 'week'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewType('day')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  viewType === 'day'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Day
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{getDateTitle()}</h2>

            <div className="flex items-center space-x-2">
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Next"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading calendar...</p>
          </div>
        ) : !calendarData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No data available</p>
          </div>
        ) : viewType === 'month' ? (
          <MonthView data={calendarData} onDayClick={handleDayClick} />
        ) : viewType === 'week' ? (
          <WeekView data={calendarData} onDayClick={handleDayClick} onSuggestShift={openSuggestModal} isAdmin={user?.role === 'ADMIN'} />
        ) : (
          <DayView data={calendarData} onSuggestShift={openSuggestModal} isAdmin={user?.role === 'ADMIN'} />
        )}
      </div>

      {user?.role === 'ADMIN' && (
        <SuggestShiftModal
          isOpen={suggestModalOpen}
          onClose={() => setSuggestModalOpen(false)}
          onSuccess={() => {
            setSuggestModalOpen(false);
            loadCalendarData();
          }}
          defaultDate={suggestModalDefaults.date}
          defaultStartTime={suggestModalDefaults.startTime}
          defaultEndTime={suggestModalDefaults.endTime}
        />
      )}
    </div>
  );
}

function MonthView({ data, onDayClick }: { data: any; onDayClick: (date: string) => void }) {
  const getCoverageStatus = (coverage: any): string => {
    if (!coverage) return 'none';
    if (coverage.morning_covered && coverage.evening_covered) return 'full';
    if (coverage.morning_covered || coverage.evening_covered) return 'partial';
    return 'none';
  };

  const getCoverageBorder = (status: string): string => {
    if (status === 'full') return 'border-l-4 border-l-green-500';
    if (status === 'partial') return 'border-l-4 border-l-yellow-500';
    return 'border-l-4 border-l-red-400';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs sm:text-sm font-semibold text-gray-700 py-3">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {data.weeks?.map((week: any, weekIdx: number) =>
          week.days?.map((day: any, dayIdx: number) => {
            const date = new Date(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            const coverageStatus = getCoverageStatus(day.coverage);
            const shifts = day.shifts || [];

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => onDayClick(day.date)}
                className={`min-h-24 sm:min-h-32 border-b border-r border-gray-200 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${getCoverageBorder(coverageStatus)} ${
                  !day.is_current_month ? 'bg-gray-50/50 opacity-40' : 'bg-white'
                } ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm sm:text-base font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {shifts.length > 0 && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {shifts.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {shifts.slice(0, 3).map((shift: any, idx: number) => {
                    const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                    const initials = paName.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                    const paId = shift.requested_by || idx;
                    const color = getPAColor(paId);

                    return (
                      <div
                        key={idx}
                        className="text-xs px-1.5 py-1 rounded truncate"
                        style={{ backgroundColor: color, color: '#fff' }}
                        title={`${paName}: ${shift.start_time} - ${shift.end_time}`}
                      >
                        <span className="font-medium">{initials}</span>
                        <span className="hidden sm:inline ml-1 opacity-90">{shift.start_time.slice(0, 5)}</span>
                      </div>
                    );
                  })}
                  {shifts.length > 3 && (
                    <div className="text-xs text-gray-500 font-medium pl-1.5">
                      +{shifts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex flex-wrap gap-4 text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-l-4 border-l-green-500 bg-white"></div>
          <span className="text-gray-700">Full coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-l-4 border-l-yellow-500 bg-white"></div>
          <span className="text-gray-700">Partial coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-l-4 border-l-red-400 bg-white"></div>
          <span className="text-gray-700">No critical coverage</span>
        </div>
      </div>
    </div>
  );
}

function WeekView({ data, onDayClick, onSuggestShift, isAdmin }: { data: any; onDayClick: (date: string) => void; onSuggestShift: (date: string) => void; isAdmin?: boolean }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = data.days || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {isAdmin && (
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <button
            onClick={() => onSuggestShift(days[0]?.date || new Date().toISOString().split('T')[0])}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Suggest Shift
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
            <div className="p-3 text-xs font-semibold text-gray-500">Time</div>
            {days.map((day: any) => {
              const date = new Date(day.date);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day.date}
                  onClick={() => onDayClick(day.date)}
                  className={`p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative">
            {hours.map((hour) => {
              const isCriticalTime = (hour >= 6 && hour < 9) || (hour >= 21 && hour < 22);
              
              return (
                <div
                  key={hour}
                  className={`grid grid-cols-8 border-b border-gray-100 ${
                    isCriticalTime ? 'bg-yellow-50/30' : ''
                  }`}
                >
                  <div className="p-2 text-xs text-gray-500 font-medium">
                    {hour.toString().padStart(2, '0')}:00
                  </div>

                  {days.map((day: any) => {
                    const shiftsInHour = (day.shifts || []).filter((shift: any) => {
                      const startHour = parseInt(shift.start_time.split(':')[0]);
                      const endHour = parseInt(shift.end_time.split(':')[0]);
                      
                      if (startHour < endHour) {
                        return hour >= startHour && hour < endHour;
                      } else {
                        return hour >= startHour || hour < endHour;
                      }
                    });

                    return (
                      <div key={`${day.date}-${hour}`} className="relative p-1 min-h-[3rem]">
                        {shiftsInHour.map((shift: any) => {
                          const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                          const paId = shift.requested_by || shift.id;
                          const color = getPAColor(paId);
                          const startHour = parseInt(shift.start_time.split(':')[0]);

                          if (hour === startHour) {
                            return (
                              <div
                                key={shift.id}
                                className="absolute inset-x-1 rounded px-2 py-1 text-xs font-medium text-white shadow-sm z-10"
                                style={{
                                  backgroundColor: color,
                                  top: '0.25rem',
                                  height: `${shift.duration_hours * 3}rem`,
                                }}
                                title={`${paName}: ${shift.start_time} - ${shift.end_time}`}
                              >
                                <div className="truncate">{paName.split(' ')[0]}</div>
                                <div className="text-xs opacity-90">{shift.start_time.slice(0, 5)}</div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-xs text-gray-600">
        <span className="inline-flex items-center space-x-1">
          <div className="w-3 h-3 bg-yellow-50 border border-yellow-200"></div>
          <span>Critical times (6-9 AM, 9-10 PM)</span>
        </span>
      </div>
    </div>
  );
}

function DayView({ data, onSuggestShift, isAdmin }: { data: any; onSuggestShift: (date: string, startTime?: string, endTime?: string) => void; isAdmin?: boolean }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const shifts = data.shifts || [];
  const coverage = data.coverage || {};

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{data.day_name}</h3>
            <div className="flex items-center space-x-4 mt-2 text-sm">
              <span className={`inline-flex items-center space-x-1 ${coverage.morning_covered ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${coverage.morning_covered ? 'bg-green-600' : 'bg-red-600'}`}></div>
                <span>Morning (6-9 AM)</span>
              </span>
              <span className={`inline-flex items-center space-x-1 ${coverage.evening_covered ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${coverage.evening_covered ? 'bg-green-600' : 'bg-red-600'}`}></div>
                <span>Evening (9-10 PM)</span>
              </span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => onSuggestShift(data.date)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Suggest Shift
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {hours.map((hour) => {
          const isCriticalTime = (hour >= 6 && hour < 9) || (hour >= 21 && hour < 22);
          const shiftsInHour = shifts.filter((shift: any) => {
            const startHour = parseInt(shift.start_time.split(':')[0]);
            const endHour = parseInt(shift.end_time.split(':')[0]);
            
            if (startHour < endHour) {
              return hour >= startHour && hour < endHour;
            } else {
              return hour >= startHour || hour < endHour;
            }
          });

          return (
            <div
              key={hour}
              className={`flex ${isCriticalTime ? 'bg-yellow-50/30' : ''}`}
            >
              <div className="w-20 sm:w-24 p-3 text-sm font-medium text-gray-500">
                {hour.toString().padStart(2, '0')}:00
              </div>

              <div className="flex-1 p-3 space-y-2">
                {shiftsInHour.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">No shifts</div>
                ) : (
                  shiftsInHour.map((shift: any) => {
                    const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                    const paId = shift.requested_by || shift.id;
                    const color = getPAColor(paId);

                    return (
                      <div
                        key={shift.id}
                        className="rounded-lg p-3 shadow-sm border"
                        style={{ borderLeftWidth: '4px', borderLeftColor: color }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{paName}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)} ({shift.duration_hours}h)
                            </div>
                            {shift.notes && (
                              <div className="text-sm text-gray-500 mt-2 italic">{shift.notes}</div>
                            )}
                          </div>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: color }}
                          >
                            {paName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}