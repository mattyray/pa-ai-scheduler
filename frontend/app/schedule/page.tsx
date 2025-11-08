'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getPAColor } from '@/lib/pa-colors';
import SuggestShiftModal from '@/app/admin/dashboard/SuggestShiftModal';
import EditShiftModal from '@/app/components/EditShiftModal';
import CancelShiftModal from '@/app/components/CancelShiftModal';
import { shiftsAPI } from '@/lib/shifts-api';
import { api } from '@/lib/api';

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

function formatTime12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatHour12(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hours12 = hour % 12 || 12;
  return `${hours12}:00 ${period}`;
}

function isOvernightShift(shift: any): boolean {
  return shift.end_time < shift.start_time;
}

function getNextDay(dateStr: string): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function getPreviousDay(dateStr: string): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, loading: authLoading } = useAuth();
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestModalDefaults, setSuggestModalDefaults] = useState({
    date: '',
    startTime: '06:00',
    endTime: '09:00',
  });

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && !initialized) {
      const view = searchParams.get('view') as 'month' | 'week' | 'day' | null;
      const dateParam = searchParams.get('date');
      
      if (view && ['month', 'week', 'day'].includes(view)) {
        setViewType(view);
      }
      
      if (dateParam) {
        try {
          const parsedDate = parseDate(dateParam);
          if (!isNaN(parsedDate.getTime())) {
            setCurrentDate(parsedDate);
          }
        } catch (e) {
          console.error('Invalid date parameter');
        }
      }
      
      loadPeriods();
      setInitialized(true);
    }
  }, [authLoading, user, searchParams, initialized]);

  useEffect(() => {
    if (!authLoading && user && initialized) {
      loadCalendarData();
    }
  }, [currentDate, viewType, authLoading, user, initialized]);

  const loadPeriods = async () => {
    try {
      const response = await api.get('/api/schedule-periods/');
      let periodsData = response.data;
      
      if (periodsData.results && Array.isArray(periodsData.results)) {
        periodsData = periodsData.results;
      } else if (!Array.isArray(periodsData)) {
        periodsData = [];
      }
      
      setPeriods(periodsData);
      
      if (periodsData.length > 0) {
        const openPeriod = periodsData.find((p: any) => p.status === 'OPEN');
        setSelectedPeriod(openPeriod?.id || periodsData[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load periods:', error);
    }
  };

  const getISOWeek = (date: Date): { year: number; week: number } => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: d.getFullYear(), week: weekNo };
  };

  const loadCalendarData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      const paFilter = '';
      
      if (viewType === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        response = await api.get(`/api/calendar/month/${year}/${month}${paFilter}`);
      } else if (viewType === 'week') {
        const { year, week } = getISOWeek(currentDate);
        response = await api.get(`/api/calendar/week/${year}/${week}${paFilter}`);
      } else {
        const dateStr = currentDate.toISOString().split('T')[0];
        response = await api.get(`/api/calendar/day/${dateStr}${paFilter}`);
      }
      
      setCalendarData(response.data);
    } catch (error: any) {
      console.error('Failed to load calendar data:', error);
      setError(`Failed to load calendar: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
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
      const d = new Date(currentDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const handleMonthDayClick = (date: string) => {
    setCurrentDate(parseDate(date));
    setViewType('week');
  };

  const handleWeekDayClick = (date: string) => {
    setCurrentDate(parseDate(date));
    setViewType('day');
  };

  const handleShiftClick = (shift: any) => {
    console.log('🔵 Shift clicked:', shift);
    
    if (shift.status === 'PENDING' && user?.role === 'ADMIN') {
      setSelectedShift(shift);
      setApproveModalOpen(true);
    } else if (shift.status === 'APPROVED') {
      const isAdmin = user?.role === 'ADMIN';
      const isOwner = shift.requested_by === user?.id;
      
      if (isAdmin) {
        setSelectedShift(shift);
        setEditModalOpen(true);
      } else if (isOwner) {
        setSelectedShift(shift);
        setCancelModalOpen(true);
      }
    }
  };

  const handleEditShift = async () => {
    setEditModalOpen(false);
    setSelectedShift(null);
    await loadCalendarData();
  };

  const handleCancelShift = async () => {
    setCancelModalOpen(false);
    setSelectedShift(null);
    await loadCalendarData();
  };

  const openSuggestModal = (date?: string, startTime?: string, endTime?: string) => {
    setSuggestModalDefaults({
      date: date || currentDate.toISOString().split('T')[0],
      startTime: startTime || '06:00',
      endTime: endTime || '09:00',
    });
    setSuggestModalOpen(true);
  };

  const handlePARequestClick = (date: string, startTime: string, endTime: string) => {
    const params = new URLSearchParams({
      date,
      start_time: startTime,
      end_time: endTime,
    });
    router.push(`/requests/new?${params.toString()}`);
  };

  if (authLoading || !initialized) {
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
              loadCalendarData();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                {Array.isArray(periods) && periods.map((period) => (
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
          <MonthView data={calendarData} onDayClick={handleMonthDayClick} onShiftClick={handleShiftClick} isAdmin={user?.role === 'ADMIN'} currentUserId={user?.id} />
        ) : viewType === 'week' ? (
          <WeekView 
            data={calendarData} 
            onDayClick={handleWeekDayClick} 
            onSuggestShift={openSuggestModal} 
            onShiftClick={handleShiftClick}
            onPARequest={handlePARequestClick}
            isAdmin={user?.role === 'ADMIN'} 
            currentUserId={user?.id} 
          />
        ) : (
          <DayView 
            data={calendarData} 
            onSuggestShift={openSuggestModal} 
            onShiftClick={handleShiftClick}
            onPARequest={handlePARequestClick}
            isAdmin={user?.role === 'ADMIN'} 
            currentUserId={user?.id} 
          />
        )}
      </div>

      {user?.role === 'ADMIN' && (
        <>
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
          
          <ApproveRejectModal
            isOpen={approveModalOpen}
            shift={selectedShift}
            onClose={() => {
              setApproveModalOpen(false);
              setSelectedShift(null);
            }}
            onSuccess={() => {
              setApproveModalOpen(false);
              setSelectedShift(null);
              loadCalendarData();
            }}
          />

          <EditShiftModal
            isOpen={editModalOpen}
            shift={selectedShift}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedShift(null);
            }}
            onSuccess={handleEditShift}
          />
        </>
      )}

      <CancelShiftModal
        isOpen={cancelModalOpen}
        shift={selectedShift}
        onClose={() => {
          setCancelModalOpen(false);
          setSelectedShift(null);
        }}
        onSuccess={handleCancelShift}
        userRole={user?.role as 'ADMIN' | 'PA'}
      />
    </div>
  );
}

function MonthView({ data, onDayClick, onShiftClick, isAdmin, currentUserId }: { data: any; onDayClick: (date: string) => void; onShiftClick: (shift: any) => void; isAdmin?: boolean; currentUserId?: number }) {
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

  const isShiftClickable = (shift: any): boolean => {
    if (shift.status === 'PENDING' && isAdmin) return true;
    if (shift.status === 'APPROVED' && isAdmin) return true;
    if (shift.status === 'APPROVED' && shift.requested_by === currentUserId) return true;
    return false;
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
            const date = parseDate(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            const coverageStatus = getCoverageStatus(day.coverage);
            const shifts = day.shifts || [];

            return (
              <div
                key={`${weekIdx}-${dayIdx}`}
                className={`min-h-24 sm:min-h-32 border-b border-r border-gray-200 p-2 ${getCoverageBorder(coverageStatus)} ${
                  !day.is_current_month ? 'bg-gray-50/50 opacity-40' : 'bg-white'
                } ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`}
              >
                <div 
                  onClick={() => onDayClick(day.date)}
                  className="cursor-pointer hover:bg-gray-50 rounded transition-colors"
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
                </div>

                <div className="space-y-1">
                  {shifts.slice(0, 3).map((shift: any, idx: number) => {
                    const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                    const initials = paName.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                    const paId = shift.requested_by || idx;
                    const color = getPAColor(paId);
                    const isPending = shift.status === 'PENDING';
                    const isClickable = isShiftClickable(shift);
                    const overnight = isOvernightShift(shift);

                    return (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isClickable) {
                            onShiftClick(shift);
                          }
                        }}
                        className={`text-xs px-1.5 py-1 rounded truncate transition-all ${
                          isPending 
                            ? 'border-2 border-dashed cursor-pointer hover:scale-105' 
                            : isClickable 
                            ? 'cursor-pointer hover:opacity-80'
                            : ''
                        }`}
                        style={isPending ? {
                          backgroundColor: color + '30',
                          borderColor: color,
                          color: color,
                        } : {
                          backgroundColor: color,
                          color: '#fff',
                        }}
                        title={`${paName}: ${formatTime12Hour(shift.start_time)} - ${formatTime12Hour(shift.end_time)}${overnight ? ' (overnight)' : ''} ${isPending ? '(PENDING - Click to approve/reject)' : isClickable ? '(Click to manage)' : ''}`}
                      >
                        <span className="font-medium">
                          {isPending && '⏳ '}
                          {overnight && '🌙 '}
                          {initials}
                        </span>
                        <span className="hidden sm:inline ml-1 opacity-90">{formatTime12Hour(shift.start_time).replace(' ', '')}</span>
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
          <div className="w-3 h-3 bg-blue-500"></div>
          <span className="text-gray-700">Approved</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-100 border-2 border-dashed border-blue-500"></div>
          <span className="text-gray-700">Pending</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-base">🌙</span>
          <span className="text-gray-700">Overnight</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 border-l-4 border-green-500 pl-2"></div>
          <span className="text-gray-700">Full Coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 border-l-4 border-yellow-500 pl-2"></div>
          <span className="text-gray-700">Partial Coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 border-l-4 border-red-400 pl-2"></div>
          <span className="text-gray-700">No Coverage</span>
        </div>
      </div>
    </div>
  );
}

function WeekView({ 
  data, 
  onDayClick, 
  onSuggestShift, 
  onShiftClick,
  onPARequest,
  isAdmin, 
  currentUserId 
}: { 
  data: any; 
  onDayClick: (date: string) => void; 
  onSuggestShift: (date: string, startTime?: string, endTime?: string) => void; 
  onShiftClick: (shift: any) => void;
  onPARequest: (date: string, startTime: string, endTime: string) => void;
  isAdmin?: boolean; 
  currentUserId?: number 
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = data.days || [];

  const isShiftClickable = (shift: any): boolean => {
    if (shift.status === 'PENDING' && isAdmin) return true;
    if (shift.status === 'APPROVED' && isAdmin) return true;
    if (shift.status === 'APPROVED' && shift.requested_by === currentUserId) return true;
    return false;
  };

  const handleCellClick = (date: string, hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endHour = hour + 3;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    if (isAdmin) {
      onSuggestShift(date, startTime, endTime);
    } else {
      onPARequest(date, startTime, endTime);
    }
  };

  const getAllShiftsForDay = (dayDate: string) => {
    const dayShifts = days.find((d: any) => d.date === dayDate)?.shifts || [];
    
    const overnightFromPrevDay: any[] = [];
    const prevDayDate = getPreviousDay(dayDate);
    const prevDay = days.find((d: any) => d.date === prevDayDate);
    
    if (prevDay && prevDay.shifts) {
      prevDay.shifts.forEach((shift: any) => {
        if (isOvernightShift(shift)) {
          overnightFromPrevDay.push({
            ...shift,
            isOvernightContinuation: true
          });
        }
      });
    }
    
    return [...dayShifts, ...overnightFromPrevDay];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
        <div className="p-3 text-xs sm:text-sm font-semibold text-gray-700 border-r border-gray-200">
          Time
        </div>
        {days.map((day: any) => {
          const date = parseDate(day.date);
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div
              key={day.date}
              className={`p-2 text-center cursor-pointer hover:bg-gray-100 transition-colors ${isToday ? 'bg-blue-50' : ''}`}
              onClick={() => onDayClick(day.date)}
            >
              <div className="text-xs text-gray-600">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-sm sm:text-base font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
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
                {formatHour12(hour)}
              </div>

              {days.map((day: any) => {
                const allShifts = getAllShiftsForDay(day.date);
                const shiftsStartingThisHour = allShifts.filter((shift: any) => {
                  const startHour = parseInt(shift.start_time.split(':')[0]);
                  return hour === startHour && !shift.isOvernightContinuation;
                });

                const overnightContinuingThrough = allShifts.filter((shift: any) => {
                  if (!shift.isOvernightContinuation) return false;
                  const endHour = parseInt(shift.end_time.split(':')[0]);
                  return hour < endHour;
                });

                const hasShift = shiftsStartingThisHour.length > 0 || overnightContinuingThrough.length > 0;

                return (
                  <div 
                    key={`${day.date}-${hour}`} 
                    className={`relative p-1 min-h-[3rem] ${!hasShift ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''}`}
                    onClick={() => !hasShift && handleCellClick(day.date, hour)}
                    title={!hasShift ? (isAdmin ? 'Click to suggest shift' : 'Click to request shift') : ''}
                  >
                    {shiftsStartingThisHour.map((shift: any) => {
                      const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                      const paId = shift.requested_by || shift.id;
                      const color = getPAColor(paId);
                      const isPending = shift.status === 'PENDING';
                      const isClickable = isShiftClickable(shift);
                      const overnight = isOvernightShift(shift);

                      return (
                        <div
                          key={shift.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isClickable) {
                              onShiftClick(shift);
                            }
                          }}
                          className={`absolute inset-x-1 rounded px-2 py-1 text-xs font-medium shadow-sm z-10 flex flex-col justify-between transition-all ${
                            isPending 
                              ? 'border-2 border-dashed cursor-pointer hover:scale-105' 
                              : isClickable
                              ? 'text-white cursor-pointer hover:opacity-80'
                              : 'text-white'
                          }`}
                          style={isPending ? {
                            backgroundColor: color + '30',
                            borderColor: color,
                            color: color,
                            top: '0.25rem',
                            height: `${Number(shift.duration_hours) * 3}rem`,
                          } : {
                            backgroundColor: color,
                            color: '#fff',
                            top: '0.25rem',
                            height: `${Number(shift.duration_hours) * 3}rem`,
                          }}
                          title={`${paName}: ${formatTime12Hour(shift.start_time)} - ${formatTime12Hour(shift.end_time)}${overnight ? ' (overnight)' : ''} ${isPending ? '(PENDING)' : isClickable ? '(Click to manage)' : ''}`}
                        >
                          <div>
                            <div className="font-semibold truncate">
                              {isPending && '⏳ '}
                              {overnight && '🌙 '}
                              {paName}
                            </div>
                            <div className="text-xs opacity-90">{formatTime12Hour(shift.start_time)}</div>
                          </div>
                          <div className="text-xs opacity-90 text-right">{formatTime12Hour(shift.end_time)}</div>
                        </div>
                      );
                    })}

                    {overnightContinuingThrough.length > 0 && shiftsStartingThisHour.length === 0 && (
                      <div className="absolute inset-0 bg-purple-100 border-l-4 border-purple-400 opacity-30"></div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> {isAdmin 
            ? 'Click on any empty time slot to suggest a shift for that time' 
            : 'Click on any empty time slot to request a shift for that time'}
        </p>
      </div>
    </div>
  );
}

function DayView({ 
  data, 
  onSuggestShift, 
  onShiftClick,
  onPARequest,
  isAdmin, 
  currentUserId 
}: { 
  data: any; 
  onSuggestShift: (date: string, startTime?: string, endTime?: string) => void; 
  onShiftClick: (shift: any) => void;
  onPARequest: (date: string, startTime: string, endTime: string) => void;
  isAdmin?: boolean; 
  currentUserId?: number 
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const shifts = data.shifts || [];

  const isShiftClickable = (shift: any): boolean => {
    if (shift.status === 'PENDING' && isAdmin) return true;
    if (shift.status === 'APPROVED' && isAdmin) return true;
    if (shift.status === 'APPROVED' && shift.requested_by === currentUserId) return true;
    return false;
  };

  const getShiftsCoveringHour = (hour: number) => {
    return shifts.filter((shift: any) => {
      const startHour = parseInt(shift.start_time.split(':')[0]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      const endMinute = parseInt(shift.end_time.split(':')[1]);
      const overnight = isOvernightShift(shift);
      
      if (overnight) {
        return startHour <= hour || (endHour > hour || (endHour === hour && endMinute > 0));
      }
      
      return startHour <= hour && (endHour > hour || (endHour === hour && endMinute > 0));
    });
  };

  const handleCellClick = (hour: number) => {
    const coveringShifts = getShiftsCoveringHour(hour);
    if (coveringShifts.length > 0) {
      const shift = coveringShifts[0];
      if (isShiftClickable(shift)) {
        onShiftClick(shift);
      }
      return;
    }
    
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endHour = hour + 3;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    if (isAdmin) {
      onSuggestShift(data.date, startTime, endTime);
    } else {
      onPARequest(data.date, startTime, endTime);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <h3 className="text-lg font-semibold text-gray-900">{data.day_name}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <div className="relative">
        {hours.map((hour) => {
          const isCriticalTime = (hour >= 6 && hour < 9) || (hour >= 21 && hour < 22);
          const shiftsStartingThisHour = shifts.filter((shift: any) => {
            const startHour = parseInt(shift.start_time.split(':')[0]);
            return hour === startHour;
          });
          
          const shiftsCoveringThisHour = getShiftsCoveringHour(hour);
          const hasShiftCoverage = shiftsCoveringThisHour.length > 0;

          return (
            <div
              key={hour}
              className={`flex border-b border-gray-100 ${
                isCriticalTime ? 'bg-yellow-50/30' : ''
              }`}
            >
              <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-100">
                {formatHour12(hour)}
              </div>

              <div 
                className={`relative p-2 min-h-[3rem] flex-1 ${
                  hasShiftCoverage && isShiftClickable(shiftsCoveringThisHour[0])
                    ? 'cursor-pointer hover:bg-blue-50/50 transition-colors'
                    : !hasShiftCoverage
                    ? 'cursor-pointer hover:bg-blue-50 transition-colors'
                    : ''
                }`}
                onClick={() => handleCellClick(hour)}
                title={
                  hasShiftCoverage && isShiftClickable(shiftsCoveringThisHour[0])
                    ? 'Click to manage shift'
                    : !hasShiftCoverage
                    ? (isAdmin ? 'Click to suggest shift' : 'Click to request shift')
                    : ''
                }
              >
                {shiftsStartingThisHour.map((shift: any) => {
                  const paName = shift.requested_by_name || shift.requested_by || 'Unknown';
                  const paId = shift.requested_by || shift.id;
                  const color = getPAColor(paId);
                  const isPending = shift.status === 'PENDING';
                  const isClickable = isShiftClickable(shift);
                  const overnight = isOvernightShift(shift);

                  return (
                    <div
                      key={shift.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isClickable) {
                          onShiftClick(shift);
                        }
                      }}
                      className={`absolute inset-x-2 rounded-lg px-4 py-2 shadow-md flex flex-col justify-between transition-all ${
                        isPending 
                          ? 'border-2 border-dashed cursor-pointer hover:scale-105' 
                          : isClickable
                          ? 'text-white cursor-pointer hover:opacity-80'
                          : 'text-white'
                      }`}
                      style={isPending ? {
                        backgroundColor: color + '30',
                        borderColor: color,
                        color: color,
                        top: '0.5rem',
                        height: `${Number(shift.duration_hours) * 3}rem`,
                        pointerEvents: 'auto',
                      } : {
                        backgroundColor: color,
                        color: '#fff',
                        top: '0.5rem',
                        height: `${Number(shift.duration_hours) * 3}rem`,
                        pointerEvents: 'auto',
                      }}
                    >
                      <div>
                        <div className="font-bold text-base">
                          {isPending && '⏳ '}
                          {overnight && '🌙 '}
                          {paName}
                          {isPending && <span className="ml-2 text-xs font-normal">(Pending)</span>}
                          {overnight && <span className="ml-2 text-xs font-normal">(Overnight)</span>}
                        </div>
                        <div className="text-sm opacity-90 mt-1">{formatTime12Hour(shift.start_time)}</div>
                      </div>
                      <div className="text-sm opacity-90 text-right font-medium">{formatTime12Hour(shift.end_time)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> {isAdmin
            ? 'Click on any empty time slot to suggest a shift, or click on a shift to manage it'
            : 'Click on any empty time slot to request a shift, or click on your shifts to cancel them'}
        </p>
      </div>
    </div>
  );
}

function ApproveRejectModal({ isOpen, shift, onClose, onSuccess }: { isOpen: boolean; shift: any; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<'choose' | 'approve' | 'reject'>('choose');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectedReason, setRejectedReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('choose');
      setAdminNotes('');
      setRejectedReason('');
    }
  }, [isOpen]);

  const handleApprove = async () => {
    if (!shift) return;
    
    setLoading(true);
    
    try {
      await shiftsAPI.approveRequest(shift.id, adminNotes);
      onSuccess();
    } catch (err: any) {
      console.error('❌ Approve failed:', err);
      
      if (err.response?.data?.error) {
        alert(`Error: ${err.response.data.error}`);
      } else if (err.response?.data?.detail) {
        alert(`Error: ${err.response.data.detail}`);
      } else {
        alert(`Failed to approve shift: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!shift || !rejectedReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    setLoading(true);
    
    try {
      await shiftsAPI.rejectRequest(shift.id, rejectedReason);
      onSuccess();
    } catch (err: any) {
      console.error('❌ Reject failed:', err);
      
      if (err.response?.data?.error) {
        alert(`Error: ${err.response.data.error}`);
      } else if (err.response?.data?.detail) {
        alert(`Error: ${err.response.data.detail}`);
      } else {
        alert(`Failed to reject shift: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !shift) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[9998]">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl relative z-[9999]">
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {mode === 'choose' && 'Review Shift Request'}
            {mode === 'approve' && 'Approve Shift Request'}
            {mode === 'reject' && 'Reject Shift Request'}
          </h3>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">PA: {shift.requested_by_name}</p>
            <p className="text-sm text-gray-600">Date: {parseDate(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-sm text-gray-600">Time: {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)} ({shift.duration_hours}h)</p>
            {shift.notes && (
              <p className="text-sm text-gray-600 mt-2 italic">Notes: "{shift.notes}"</p>
            )}
          </div>

          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('approve')}
                className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                ✓ Approve Request
              </button>
              <button
                onClick={() => setMode('reject')}
                className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                ✗ Reject Request
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {mode === 'approve' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Add any notes about this approval..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Approving...' : 'Confirm Approval'}
                </button>
                <button
                  onClick={() => setMode('choose')}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectedReason}
                  onChange={(e) => setRejectedReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Please explain why this request is being rejected..."
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectedReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => setMode('choose')}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}