'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI } from '@/lib/schedules-api';
import { shiftsAPI } from '@/lib/shifts-api';
import { getPAColor } from '@/lib/pa-colors';
import SuggestShiftModal from './SuggestShiftModal';

interface DashboardStats {
  pending_requests: number;
  coverage_gaps: number;
  total_shifts: number;
  active_pas: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAdmin, loading, logout } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    pending_requests: 0,
    coverage_gaps: 0,
    total_shifts: 0,
    active_pas: 0,
  });
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [coverageGaps, setCoverageGaps] = useState<any[]>([]);
  const [calendarData, setCalendarData] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState<any>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/login');
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin, currentMonth]);

  const loadDashboardData = async () => {
    try {
      setDataLoading(true);
      
      const shiftsResponse = await shiftsAPI.listRequests();
      const allShifts = shiftsResponse.data.results || [];
      const pending = allShifts.filter((s: any) => s.status === 'PENDING');
      const approved = allShifts.filter((s: any) => s.status === 'APPROVED');
      
      const uniquePAs = new Set(allShifts.map((s: any) => s.requested_by));
      
      setStats({
        pending_requests: pending.length,
        coverage_gaps: 0,
        total_shifts: approved.length,
        active_pas: uniquePAs.size,
      });
      
      const today = new Date().toISOString().split('T')[0];
      const todayData = await schedulesAPI.getDayView(today);
      setTodayShifts(todayData.data.shifts || []);
      
      const monthData = await schedulesAPI.getMonthView(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );
      setCalendarData(monthData.data);
      
      const gaps: any[] = [];
      monthData.data.weeks?.forEach((week: any) => {
        week.days?.forEach((day: any) => {
          if (day.is_current_month && new Date(day.date) >= new Date()) {
            if (!day.coverage?.morning_covered) {
              gaps.push({
                date: day.date,
                time_slot: 'morning',
                date_formatted: new Date(day.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
                start_time: '06:00',
                end_time: '09:00',
              });
            }
            if (!day.coverage?.evening_covered) {
              gaps.push({
                date: day.date,
                time_slot: 'evening',
                date_formatted: new Date(day.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
                start_time: '21:00',
                end_time: '22:00',
              });
            }
          }
        });
      });
      setCoverageGaps(gaps.slice(0, 5));
      setStats(prev => ({ ...prev, coverage_gaps: gaps.length }));
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleDayClick = (date: string) => {
    router.push(`/schedule?view=week&date=${date}`);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleSuggestShift = (gap: any) => {
    setSelectedGap(gap);
    setShowSuggestModal(true);
  };

  const handleSuggestionSuccess = () => {
    loadDashboardData();
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">{stats.pending_requests}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Coverage Gaps</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{stats.coverage_gaps}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Shifts</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{stats.total_shifts}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active PAs</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">{stats.active_pas}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-md transition"
                  >
                    <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                  >
                    Today
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-md transition"
                  >
                    <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <MiniMonthCalendar data={calendarData} onDayClick={handleDayClick} />
              <p className="mt-4 text-xs text-gray-500 text-center">
                Click any day to view that week's schedule
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Today's Shifts</h3>
            </div>
            <div className="p-6">
              {todayShifts.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">No shifts today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="p-3 rounded-lg border-l-4"
                      style={{ 
                        backgroundColor: getPAColor(shift.requested_by) + '10',
                        borderLeftColor: getPAColor(shift.requested_by)
                      }}
                    >
                      <p className="text-sm font-semibold text-gray-900">{shift.pa_name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{shift.duration_hours}h</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Coverage Gaps</h3>
                <span className="px-2.5 py-0.5 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                  {coverageGaps.length}
                </span>
              </div>
            </div>
            <div className="p-6">
              {coverageGaps.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">All clear!</p>
                  <p className="text-xs text-gray-500">No coverage gaps</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coverageGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {gap.date_formatted}
                        </p>
                        <p className="text-xs text-gray-600">
                          {gap.time_slot === 'morning' ? 'Morning (6-9 AM)' : 'Evening (9-10 PM)'}
                        </p>
                      </div>
                      <button
                        className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition"
                        onClick={() => handleSuggestShift(gap)}
                      >
                        Suggest Shift
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/requests')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition group"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">Approve Requests</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => router.push('/schedule')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition group"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">View Full Schedule</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => router.push('/admin/periods')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition group"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">Manage Periods</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>

      <SuggestShiftModal
        isOpen={showSuggestModal}
        onClose={() => {
          setShowSuggestModal(false);
          setSelectedGap(null);
        }}
        onSuccess={handleSuggestionSuccess}
        defaultDate={selectedGap?.date}
        defaultStartTime={selectedGap?.start_time}
        defaultEndTime={selectedGap?.end_time}
      />
    </div>
  );
}

function MiniMonthCalendar({ data, onDayClick }: { data: any; onDayClick: (date: string) => void }) {
  if (!data) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-2 text-sm text-gray-500">Loading calendar...</p>
      </div>
    );
  }

  const getCoverageColor = (coverage: any) => {
    if (!coverage) return 'bg-red-50 border-red-200';
    if (coverage.morning_covered && coverage.evening_covered) return 'bg-green-50 border-green-200';
    if (coverage.morning_covered || coverage.evening_covered) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {data.weeks?.map((week: any, weekIdx: number) =>
          week.days?.map((day: any, dayIdx: number) => {
            const date = new Date(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            const coverageColor = getCoverageColor(day.coverage);

            return (
              <button
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => day.is_current_month && onDayClick(day.date)}
                className={`aspect-square p-2 rounded-md text-sm font-medium border-2 transition-all ${
                  !day.is_current_month 
                    ? 'text-gray-300 bg-gray-50 border-gray-100 cursor-default' 
                    : `${coverageColor} hover:shadow-md cursor-pointer`
                } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={`${isToday ? 'text-blue-600 font-bold' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-600">
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 bg-green-100 border-2 border-green-300 rounded"></div>
          <span>Full Coverage</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
          <span>Partial</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 bg-red-100 border-2 border-red-300 rounded"></div>
          <span>No Coverage</span>
        </div>
      </div>
    </div>
  );
}

function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
