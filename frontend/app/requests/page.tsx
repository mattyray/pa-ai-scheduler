'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { shiftsAPI, ShiftRequest } from '@/lib/shifts-api';

type TabType = 'pending' | 'approved' | 'rejected';

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

export default function RequestsPage() {
  const router = useRouter();
  const { user, isPA, isAdmin, loading: authLoading, logout } = useAuth();

  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await shiftsAPI.listShifts();
      const shiftsData = response.data.results || response.data;
      
      let requestsList = Array.isArray(shiftsData) ? shiftsData : [];
      
      if (isPA) {
        requestsList = requestsList.filter(r => r.requested_by === user?.id);
      }
      
      requestsList.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
      
      setRequests(requestsList);
    } catch (err) {
      console.error('Failed to load requests:', err);
      showToast('Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (id: number) => {
    try {
      await shiftsAPI.approveRequest(id);
      showToast('Shift approved successfully!', 'success');
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      loadRequests();
    } catch (err: any) {
      console.error('Failed to approve request:', err);
      showToast(err.response?.data?.error || 'Failed to approve request', 'error');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(Array.from(selectedIds).map(id => shiftsAPI.approveRequest(id)));
      showToast(`${selectedIds.size} shifts approved successfully!`, 'success');
      setSelectedIds(new Set());
      loadRequests();
    } catch (err) {
      console.error('Failed to bulk approve:', err);
      showToast('Some approvals failed', 'error');
    }
  };

  const handleRejectClick = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const handleRejectConfirm = async (id: number) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      await shiftsAPI.rejectRequest(id, rejectReason);
      showToast('Request rejected', 'success');
      setRejectingId(null);
      setRejectReason('');
      loadRequests();
    } catch (err) {
      console.error('Failed to reject request:', err);
      showToast('Failed to reject request', 'error');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      await shiftsAPI.cancelRequest(id);
      showToast('Request cancelled', 'success');
      loadRequests();
    } catch (err) {
      console.error('Failed to cancel request:', err);
      showToast('Failed to cancel request', 'error');
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const currentTabRequests = getFilteredRequests();
    if (selectedIds.size === currentTabRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentTabRequests.map(r => r.id)));
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = parseDate(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'TODAY';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'TOMORROW';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const isUrgent = (dateStr: string) => {
    const date = parseDate(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date <= tomorrow;
  };

  const isOvernight = (startTime: string, endTime: string) => {
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    return end < start;
  };

  const getFilteredRequests = () => {
    let filtered = requests;

    if (activeTab === 'pending') {
      filtered = filtered.filter(r => r.status === 'PENDING');
    } else if (activeTab === 'approved') {
      filtered = filtered.filter(r => r.status === 'APPROVED');
    } else if (activeTab === 'rejected') {
      filtered = filtered.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const paName = r.requested_by_name?.toLowerCase() || '';
        const date = parseDate(r.date).toLocaleDateString('en-US').toLowerCase();
        const notes = r.notes?.toLowerCase() || '';
        const period = r.schedule_period_name?.toLowerCase() || '';
        
        return paName.includes(query) || 
               date.includes(query) || 
               notes.includes(query) ||
               period.includes(query);
      });
    }

    return filtered;
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length;

  const filteredRequests = getFilteredRequests();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white flex items-center space-x-3`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {isAdmin ? 'Shift Requests' : 'My Requests'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {isPA && (
                <button
                  onClick={() => router.push('/requests/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Request
                </button>
              )}
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

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6 pt-4">
              <nav className="flex space-x-8">
                <button
                  onClick={() => {
                    setActiveTab('pending');
                    setSelectedIds(new Set());
                  }}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'pending'
                      ? 'border-yellow-500 text-yellow-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>Pending Approval</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {pendingCount}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('approved');
                    setSelectedIds(new Set());
                  }}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'approved'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>Approved</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {approvedCount}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('rejected');
                    setSelectedIds(new Set());
                  }}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'rejected'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>Rejected / Cancelled</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'rejected' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {rejectedCount}
                    </span>
                  </div>
                </button>
              </nav>

              {isAdmin && activeTab === 'pending' && filteredRequests.length > 0 && (
                <div className="flex items-center space-x-3 pb-4">
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedIds.size === filteredRequests.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkApprove}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Approve Selected ({selectedIds.size})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by PA name, date, notes, or period..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-gray-600">
                Found {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {activeTab === 'pending' && (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
                {activeTab === 'approved' && (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
                {activeTab === 'rejected' && (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery ? 'No results found' : `No ${activeTab} requests`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : activeTab === 'pending' && isPA
                  ? 'Get started by creating a new shift request'
                  : `No ${activeTab} requests to display`
                }
              </p>
              {activeTab === 'pending' && isPA && !searchQuery && (
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/requests/new')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Request
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div
                key={request.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
                  activeTab === 'pending' && isUrgent(request.date) 
                    ? 'border-orange-300 bg-orange-50/30' 
                    : activeTab === 'pending'
                    ? 'border-gray-200 hover:border-blue-300'
                    : activeTab === 'approved'
                    ? 'border-l-4 border-l-green-500 border-t border-r border-b border-gray-200'
                    : 'border-l-4 border-l-red-400 border-t border-r border-b border-gray-200'
                } ${selectedIds.has(request.id) ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {isAdmin && activeTab === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(request.id)}
                          onChange={() => toggleSelection(request.id)}
                          className="mt-1 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${
                            activeTab === 'pending' && isUrgent(request.date) 
                              ? 'bg-orange-500 text-white' 
                              : activeTab === 'pending'
                              ? 'bg-blue-500 text-white'
                              : activeTab === 'approved'
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                          }`}>
                            {formatDate(request.date)}
                          </span>
                          {isOvernight(request.start_time, request.end_time) && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                              🌙 Overnight
                            </span>
                          )}
                          {activeTab !== 'pending' && (
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              activeTab === 'approved' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status}
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <p className="text-lg font-semibold text-gray-900 mb-1">
                            {request.requested_by_name}
                          </p>
                        )}

                        <div className="flex items-center space-x-4 text-gray-600 mb-2">
                          <div className="flex items-center space-x-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">
                              {formatTime(request.start_time)} → {formatTime(request.end_time)}
                            </span>
                            <span className="text-gray-400">({request.duration_hours}h)</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-500">
                          📅 {request.schedule_period_name}
                        </p>

                        {request.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Notes:</span> {request.notes}
                            </p>
                          </div>
                        )}

                        {request.rejected_reason && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-sm text-red-800">
                              <span className="font-medium">Rejection reason:</span> {request.rejected_reason}
                            </p>
                          </div>
                        )}

                        {request.cancellation_reason && (
                          <div className="mt-3 p-3 bg-gray-100 rounded-lg border border-gray-300">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Cancellation reason:</span> {request.cancellation_reason}
                            </p>
                          </div>
                        )}

                        {rejectingId === request.id && (
                          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Rejection Reason *
                            </label>
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              rows={3}
                              placeholder="Explain why this request is being rejected..."
                              autoFocus
                            />
                            <div className="flex space-x-2 mt-3">
                              <button
                                onClick={() => handleRejectConfirm(request.id)}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Confirm Rejection
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {rejectingId !== request.id && activeTab === 'pending' && (
                      <div className="flex flex-col space-y-2 ml-4">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleApprove(request.id)}
                              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow flex items-center space-x-2"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick(request.id)}
                              className="px-6 py-3 bg-white border-2 border-red-300 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {isPA && (
                          <button
                            onClick={() => handleCancel(request.id)}
                            className="px-4 py-2 bg-white border-2 border-red-300 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}