'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { shiftsAPI, ShiftRequest } from '@/lib/shifts-api';

export default function RequestsPage() {
  const router = useRouter();
  const { user, isPA, isAdmin, loading: authLoading, logout } = useAuth();

  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApproved, setShowApproved] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
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
      
      requestsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
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
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map(r => r.id)));
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
    const date = new Date(dateStr);
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
    const date = new Date(dateStr);
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

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED');

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
      {/* Toast Notification */}
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

      {/* Navigation */}
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

      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Pending Requests Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900">
                Pending Approval
              </h2>
              <span className="px-3 py-1 text-sm font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                {pendingRequests.length}
              </span>
            </div>
            {isAdmin && pendingRequests.length > 0 && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedIds.size === pendingRequests.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve Selected ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">All caught up!</h3>
              <p className="mt-1 text-sm text-gray-500">No pending requests to review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
                    isUrgent(request.date) 
                      ? 'border-orange-300 bg-orange-50/30' 
                      : 'border-gray-200 hover:border-blue-300'
                  } ${selectedIds.has(request.id) ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {isAdmin && (
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
                              isUrgent(request.date) 
                                ? 'bg-orange-500 text-white' 
                                : 'bg-blue-500 text-white'
                            }`}>
                              {formatDate(request.date)}
                            </span>
                            {isOvernight(request.start_time, request.end_time) && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                                🌙 Overnight
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

                      {rejectingId !== request.id && (
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
              ))}
            </div>
          )}
        </div>

        {/* Approved Requests Section */}
        <div className="mb-8">
          <button
            onClick={() => setShowApproved(!showApproved)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900">Approved</h2>
              <span className="px-2.5 py-0.5 text-sm font-semibold text-green-800 bg-green-100 rounded-full">
                {approvedRequests.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showApproved ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showApproved && (
            <div className="mt-3 space-y-2">
              {approvedRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-lg p-4 border-l-4 border-green-500 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-900">{formatDate(request.date)}</span>
                        {isAdmin && <span className="text-gray-600">• {request.requested_by_name}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatTime(request.start_time)} → {formatTime(request.end_time)} ({request.duration_hours}h)
                      </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                      APPROVED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rejected Requests Section */}
        <div>
          <button
            onClick={() => setShowRejected(!showRejected)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900">Rejected / Cancelled</h2>
              <span className="px-2.5 py-0.5 text-sm font-semibold text-gray-800 bg-gray-200 rounded-full">
                {rejectedRequests.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showRejected ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRejected && (
            <div className="mt-3 space-y-2">
              {rejectedRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-lg p-4 border-l-4 border-red-400 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-900">{formatDate(request.date)}</span>
                        {isAdmin && <span className="text-gray-600">• {request.requested_by_name}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatTime(request.start_time)} → {formatTime(request.end_time)} ({request.duration_hours}h)
                      </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                      {request.status}
                    </span>
                  </div>
                  {request.rejected_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-sm text-red-800">
                        <span className="font-medium">Reason:</span> {request.rejected_reason}
                      </p>
                    </div>
                  )}
                  {request.cancellation_reason && (
                    <div className="mt-2 p-2 bg-gray-100 rounded border border-gray-300">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Cancellation reason:</span> {request.cancellation_reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}