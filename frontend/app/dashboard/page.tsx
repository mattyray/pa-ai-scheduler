'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { suggestionsAPI, ShiftSuggestion } from '@/lib/suggestions-api';
import { shiftsAPI } from '@/lib/shifts-api';
import { schedulesAPI } from '@/lib/schedules-api';
import { getPAColor } from '@/lib/pa-colors';
import MonthView from '@/app/components/calendar/MonthView';
import { parseDate, formatTime12Hour } from '@/app/components/calendar/utils';

interface PAStats {
  upcoming_shifts: number;
  hours_this_week: number;
  pending_requests: number;
  hours_this_month: number;
}

export default function PADashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  
  const [suggestions, setSuggestions] = useState<ShiftSuggestion[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<PAStats>({
    upcoming_shifts: 0,
    hours_this_week: 0,
    pending_requests: 0,
    hours_this_month: 0,
  });
  const [calendarData, setCalendarData] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ShiftSuggestion | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user && user.role === 'PA') {
      loadDashboardData();
    }
  }, [user, currentMonth]);

  const loadDashboardData = async () => {
    try {
      setDataLoading(true);
      
      const [suggestionsRes, requestsRes] = await Promise.all([
        suggestionsAPI.list(),
        shiftsAPI.listRequests(),
      ]);
      
      console.log('Suggestions API Response:', suggestionsRes.data);
      
      let allSuggestions: ShiftSuggestion[] = [];
      const responseData = suggestionsRes.data as any;
      
      if (Array.isArray(responseData)) {
        allSuggestions = responseData;
      } else if (responseData?.results && Array.isArray(responseData.results)) {
        allSuggestions = responseData.results;
      }
      
      console.log('All suggestions:', allSuggestions);
      console.log('Current user ID:', user?.id);
      
      const pendingSuggestions = allSuggestions.filter((s: ShiftSuggestion) => 
        s.status === 'PENDING' && s.suggested_to === user?.id
      );
      
      console.log('Pending suggestions for this PA:', pendingSuggestions);
      setSuggestions(pendingSuggestions);
      
      const allRequests = requestsRes.data.results || requestsRes.data;
      const requestsArray = Array.isArray(allRequests) ? allRequests : [];
      setRecentRequests(requestsArray.slice(0, 5));
      
      const monthData = await schedulesAPI.getMonthView(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );
      setCalendarData(monthData.data);
      
      calculateStats(requestsArray);
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const calculateStats = (requests: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const approved = requests.filter(r => r.status === 'APPROVED');
    const pending = requests.filter(r => r.status === 'PENDING');
    
    const upcomingShifts = approved.filter(r => parseDate(r.date) >= today);
    
    const thisWeekShifts = approved.filter(r => {
      const shiftDate = parseDate(r.date);
      return shiftDate >= startOfWeek && shiftDate <= endOfWeek;
    });
    
    const thisMonthShifts = approved.filter(r => {
      const shiftDate = parseDate(r.date);
      return shiftDate >= startOfMonth && shiftDate <= endOfMonth;
    });
    
    const hoursThisWeek = thisWeekShifts.reduce((sum, r) => sum + parseFloat(r.duration_hours || 0), 0);
    const hoursThisMonth = thisMonthShifts.reduce((sum, r) => sum + parseFloat(r.duration_hours || 0), 0);
    
    setStats({
      upcoming_shifts: upcomingShifts.length,
      hours_this_week: hoursThisWeek,
      pending_requests: pending.length,
      hours_this_month: hoursThisMonth,
    });
  };

  const handleAcceptSuggestion = async (suggestionId: number) => {
    if (window.confirm('This will create a shift request that must be approved by admin. Continue?')) {
      try {
        setActionLoading(suggestionId);
        await suggestionsAPI.accept(suggestionId);
        await loadDashboardData();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to accept suggestion');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleDeclineSuggestion = async () => {
    if (!selectedSuggestion) return;
    
    try {
      setActionLoading(selectedSuggestion.id);
      await suggestionsAPI.decline(selectedSuggestion.id, declineReason);
      await loadDashboardData();
      setShowDeclineModal(false);
      setSelectedSuggestion(null);
      setDeclineReason('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to decline suggestion');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeclineModal = (suggestion: ShiftSuggestion) => {
    setSelectedSuggestion(suggestion);
    setShowDeclineModal(true);
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
              <h1 className="text-xl font-bold text-gray-900">PA Dashboard</h1>
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
        
        <div className="mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome, {user?.first_name}!
              </h2>
              <p className="text-gray-600">
                Personal Assistant Dashboard - View your approved and pending shifts
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Shifts</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">{stats.upcoming_shifts}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hours This Week</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{stats.hours_this_week.toFixed(1)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="mt-2 text-3xl font-bold text-yellow-600">{stats.pending_requests}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month Hours</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">{stats.hours_this_month.toFixed(1)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Shift Suggestions ({suggestions.length})
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Shifts suggested by administrators for you to review
              </p>
            </div>
            
            <div className="p-6">
              {suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">No pending suggestions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Administrators can suggest shifts for you to accept or decline
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <p className="text-base font-semibold text-gray-900">
                            {parseDate(suggestion.date).toLocaleDateString('en-US', { 
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatTime12Hour(suggestion.start_time)} - {formatTime12Hour(suggestion.end_time)}
                            <span className="text-gray-400 ml-2">•</span>
                            <span className="ml-2">{suggestion.duration_hours} hours</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Suggested by {suggestion.suggested_by_name}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Pending Review
                          </span>
                        </div>
                      </div>
                      
                      {suggestion.message && (
                        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-sm text-gray-700 italic">
                            "{suggestion.message}"
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Accepting creates a shift request pending admin approval
                        </p>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => openDeclineModal(suggestion)}
                            disabled={actionLoading === suggestion.id}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptSuggestion(suggestion.id)}
                            disabled={actionLoading === suggestion.id}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {actionLoading === suggestion.id ? 'Processing...' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              <MonthView 
                data={calendarData} 
                onDayClick={handleDayClick}
                userId={user?.id}
                isAdmin={false}
              />
              <p className="mt-4 text-xs text-gray-500 text-center">
                Click any day to view that week's schedule
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Requests</h3>
            </div>
            <div className="p-6">
              {recentRequests.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">No requests yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-3 rounded-lg border-l-4"
                      style={{ 
                        backgroundColor: getPAColor(request.requested_by) + '10',
                        borderLeftColor: getPAColor(request.requested_by)
                      }}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {parseDate(request.date).toLocaleDateString('en-US', { 
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {formatTime12Hour(request.start_time)} - {formatTime12Hour(request.end_time)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{request.duration_hours}h</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          <button
            onClick={() => router.push('/requests/new')}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="ml-5 text-left">
                  <h4 className="text-lg font-medium text-gray-900">Request Shift</h4>
                  <p className="text-sm text-gray-500">Submit new request</p>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/requests')}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-5 text-left">
                  <h4 className="text-lg font-medium text-gray-900">My Requests</h4>
                  <p className="text-sm text-gray-500">View all requests</p>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/schedule')}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 text-left">
                  <h4 className="text-lg font-medium text-gray-900">View Schedule</h4>
                  <p className="text-sm text-gray-500">See approved & pending shifts</p>
                </div>
              </div>
            </div>
          </button>
        </div>

      </main>

      {showDeclineModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDeclineModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decline Shift Suggestion</h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Please provide a reason for declining (optional):
                </p>
                
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={4}
                  placeholder="I have another commitment that day..."
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleDeclineSuggestion}
                  disabled={actionLoading !== null}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {actionLoading !== null ? 'Processing...' : 'Decline Suggestion'}
                </button>
                <button
                  onClick={() => {
                    setShowDeclineModal(false);
                    setSelectedSuggestion(null);
                    setDeclineReason('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}