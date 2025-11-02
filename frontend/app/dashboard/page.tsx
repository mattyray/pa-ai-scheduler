'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { suggestionsAPI, ShiftSuggestion } from '@/lib/suggestions-api';
import { shiftsAPI } from '@/lib/shifts-api';
import { getPAColor } from '@/lib/pa-colors';

export default function PADashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  
  const [suggestions, setSuggestions] = useState<ShiftSuggestion[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
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
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setDataLoading(true);
      
      const [suggestionsRes, requestsRes] = await Promise.all([
        suggestionsAPI.list(),
        shiftsAPI.listRequests(),
      ]);
      
      const allSuggestions = suggestionsRes.data;
      const pendingSuggestions = Array.isArray(allSuggestions) 
        ? allSuggestions.filter(s => s.status === 'PENDING')
        : [];
      setSuggestions(pendingSuggestions);
      
      const allRequests = requestsRes.data.results || requestsRes.data;
      setRecentRequests(Array.isArray(allRequests) ? allRequests.slice(0, 5) : []);
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setDataLoading(false);
    }
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

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
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
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          
          <div className="mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome, {user?.first_name}!
                </h2>
                <p className="text-gray-600">
                  Personal Assistant Dashboard
                </p>
              </div>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-2">🔔</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Shift Suggestions ({suggestions.length})
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="bg-white rounded-lg p-4 shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(suggestion.date).toLocaleDateString('en-US', { 
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatTime12Hour(suggestion.start_time)} - {formatTime12Hour(suggestion.end_time)} 
                            <span className="text-gray-500"> ({suggestion.duration_hours} hours)</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Suggested by: {suggestion.suggested_by_name}
                          </p>
                        </div>
                      </div>
                      
                      {suggestion.message && (
                        <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700 italic">
                          "{suggestion.message}"
                        </div>
                      )}
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion.id)}
                          disabled={actionLoading === suggestion.id}
                          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionLoading === suggestion.id ? 'Processing...' : '✓ Accept'}
                        </button>
                        <button
                          onClick={() => openDeclineModal(suggestion)}
                          disabled={actionLoading === suggestion.id}
                          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          ✗ Decline
                        </button>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-2">
                        Note: Accepting creates a shift request that still needs admin approval
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <button
              onClick={() => router.push('/requests/new')}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
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
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
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
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
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
                    <p className="text-sm text-gray-500">See all shifts</p>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Requests</h3>
              {recentRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No requests yet</p>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      style={{
                        backgroundColor: getPAColor(request.requested_by) + '10',
                        borderColor: getPAColor(request.requested_by) + '40',
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(request.date).toLocaleDateString('en-US', { 
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatTime12Hour(request.start_time)} - {formatTime12Hour(request.end_time)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {showDeclineModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDeclineModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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

function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
