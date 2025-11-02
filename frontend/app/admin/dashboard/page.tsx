'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI } from '@/lib/schedules-api';
import { shiftsAPI } from '@/lib/shifts-api';
import { getPAColor } from '@/lib/pa-colors';

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
      
      // Load stats
      const shiftsResponse = await shiftsAPI.listRequests();
      const allShifts = shiftsResponse.data.results || shiftsResponse.data;
      const pending = allShifts.filter((s: any) => s.status === 'PENDING');
      const approved = allShifts.filter((s: any) => s.status === 'APPROVED');
      
      // Get unique PAs
      const uniquePAs = new Set(allShifts.map((s: any) => s.requested_by));
      
      setStats({
        pending_requests: pending.length,
        coverage_gaps: 0, // Will calculate from calendar
        total_shifts: approved.length,
        active_pas: uniquePAs.size,
      });
      
      // Load today's shifts
      const today = new Date().toISOString().split('T')[0];
      const todayData = await schedulesAPI.getDayView(today);
      setTodayShifts(todayData.data.shifts || []);
      
      // Load month calendar
      const monthData = await schedulesAPI.getMonthView(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );
      setCalendarData(monthData.data);
      
      // Calculate coverage gaps
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
              });
            }
          }
        });
      });
      setCoverageGaps(gaps.slice(0, 5)); // Top 5 gaps
      setStats(prev => ({ ...prev, coverage_gaps: gaps.length }));
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleDayClick = (date: string) => {
    // Navigate to week view for that date
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

  if (loading || dataLoading) {
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
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
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
          
          {/* Top Row: Calendar + Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Month Calendar - 2 columns */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Today
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <MiniMonthCalendar data={calendarData} onDayClick={handleDayClick} />
                
                <p className="mt-3 text-xs text-gray-500 text-center">
                  Click any day to view that week
                </p>
              </div>
            </div>

            {/* Quick Stats - 1 column */}
            <div className="space-y-4">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">📋 Pending Requests</span>
                    <span className="text-lg font-bold text-blue-600">{stats.pending_requests}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">❌ Coverage Gaps</span>
                    <span className="text-lg font-bold text-red-600">{stats.coverage_gaps}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">✅ Total Shifts</span>
                    <span className="text-lg font-bold text-green-600">{stats.total_shifts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">👥 Active PAs</span>
                    <span className="text-lg font-bold text-purple-600">{stats.active_pas}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => router.push('/requests')}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  View All Pending
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Today's Shifts + Coverage Gaps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            
            {/* Today's Shifts */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Shifts</h3>
              {todayShifts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No shifts scheduled for today</p>
              ) : (
                <div className="space-y-2">
                  {todayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ 
                        backgroundColor: getPAColor(shift.requested_by) + '20',
                        borderColor: getPAColor(shift.requested_by)
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{shift.pa_name}</p>
                        <p className="text-xs text-gray-600">
                          {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">{shift.duration_hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coverage Gaps */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Coverage Gaps ({coverageGaps.length})
              </h3>
              {coverageGaps.length === 0 ? (
                <div className="text-center py-4">
                  <span className="text-3xl">🎉</span>
                  <p className="text-sm text-gray-500 mt-2">No coverage gaps!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {coverageGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {gap.date_formatted} - {gap.time_slot === 'morning' ? 'Morning' : 'Evening'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {gap.time_slot === 'morning' ? '6:00 AM - 9:00 AM' : '9:00 PM - 10:00 PM'}
                        </p>
                      </div>
                      <button
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                        onClick={() => {
                          // TODO: Open suggest shift modal
                          alert('Suggest shift feature coming in Phase 4!');
                        }}
                      >
                        Suggest
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/admin/periods')}
                className="flex items-center justify-center px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition"
              >
                <svg className="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">Manage Periods</span>
              </button>
              
              <button
                onClick={() => router.push('/schedule')}
                className="flex items-center justify-center px-4 py-3 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition"
              >
                <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">View Schedule</span>
              </button>
              
              <button
                onClick={() => router.push('/requests')}
                className="flex items-center justify-center px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">Approve Requests</span>
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Mini Month Calendar Component for Dashboard
function MiniMonthCalendar({ data, onDayClick }: { data: any; onDayClick: (date: string) => void }) {
  if (!data) return null;

  const getCoverageIndicator = (coverage: any) => {
    if (!coverage) return '❌';
    if (coverage.morning_covered && coverage.evening_covered) return '✅';
    if (coverage.morning_covered || coverage.evening_covered) return '⚠️';
    return '❌';
  };

  return (
    <div>
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div key={idx} className="text-center text-xs font-semibold text-gray-600 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {data.weeks?.map((week: any, weekIdx: number) =>
          week.days?.map((day: any, dayIdx: number) => {
            const date = new Date(day.date);
            const isToday = date.toDateString() === new Date().toDateString();
            const indicator = getCoverageIndicator(day.coverage);

            return (
              <button
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => onDayClick(day.date)}
                className={`aspect-square p-1 rounded text-xs font-medium border transition-all ${
                  !day.is_current_month 
                    ? 'text-gray-300 bg-gray-50' 
                    : 'text-gray-900 bg-white hover:bg-blue-50 hover:border-blue-300'
                } ${isToday ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={isToday ? 'text-blue-600 font-bold' : ''}>{date.getDate()}</span>
                  {day.is_current_month && <span className="text-[10px]">{indicator}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Helper function
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
