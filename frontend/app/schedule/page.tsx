'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import MonthView from '@/app/components/calendar/MonthView';
import WeekView from '@/app/components/calendar/WeekView';
import DayView from '@/app/components/calendar/DayView';
import CreateShiftModal from '@/app/components/CreateShiftModal';
import SuggestShiftModal from '@/app/admin/dashboard/SuggestShiftModal';
import EditShiftModal from '@/app/components/EditShiftModal';
import CancelShiftModal from '@/app/components/CancelShiftModal';
import { shiftsAPI } from '@/lib/shifts-api';
import { api } from '@/lib/api';
import { parseDate, getISOWeek } from '@/app/components/calendar/utils';

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
  
  const [createShiftModalOpen, setCreateShiftModalOpen] = useState(false);
  const [createShiftDefaults, setCreateShiftDefaults] = useState({
    date: '',
    startTime: '06:00',
    endTime: '09:00',
  });

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

  const handleWeekDayHeaderClick = (date: string) => {
    setCurrentDate(parseDate(date));
    setViewType('day');
  };

  const handleWeekEmptySlotClick = (date: string, hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    let endTime;
    
    if (hour === 6) {
      endTime = '09:00';
    } else if (hour === 21) {
      endTime = '22:00';
    } else {
      const endHour = hour + 3;
      endTime = `${endHour.toString().padStart(2, '0')}:00`;
    }
    
    if (user?.role === 'ADMIN') {
      setSuggestModalDefaults({ date, startTime, endTime });
      setSuggestModalOpen(true);
    } else {
      setCreateShiftDefaults({ date, startTime, endTime });
      setCreateShiftModalOpen(true);
    }
  };

  const handleDayEmptySlotClick = (date: string, hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    let endTime;
    
    if (hour === 6) {
      endTime = '09:00';
    } else if (hour === 21) {
      endTime = '22:00';
    } else {
      const endHour = hour + 3;
      endTime = `${endHour.toString().padStart(2, '0')}:00`;
    }
    
    if (user?.role === 'ADMIN') {
      setSuggestModalDefaults({ date, startTime, endTime });
      setSuggestModalOpen(true);
    } else {
      setCreateShiftDefaults({ date, startTime, endTime });
      setCreateShiftModalOpen(true);
    }
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

  const handleModalSuccess = () => {
    loadCalendarData();
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
          <MonthView 
            data={calendarData} 
            onDayClick={handleMonthDayClick} 
            onShiftClick={handleShiftClick}
            isAdmin={user?.role === 'ADMIN'} 
            userId={user?.id}
            showCoverage={user?.role === 'ADMIN'}
          />
        ) : viewType === 'week' ? (
          <WeekView 
            data={calendarData} 
            onDayHeaderClick={handleWeekDayHeaderClick}
            onEmptySlotClick={handleWeekEmptySlotClick}
            onShiftClick={handleShiftClick}
            isAdmin={user?.role === 'ADMIN'} 
            userId={user?.id} 
          />
        ) : (
          <DayView 
            data={calendarData} 
            onEmptySlotClick={handleDayEmptySlotClick}
            onShiftClick={handleShiftClick}
            isAdmin={user?.role === 'ADMIN'} 
            userId={user?.id} 
          />
        )}
      </div>

      {user?.role === 'PA' && (
        <CreateShiftModal
          isOpen={createShiftModalOpen}
          onClose={() => setCreateShiftModalOpen(false)}
          onSuccess={() => {
            setCreateShiftModalOpen(false);
            handleModalSuccess();
          }}
          defaultDate={createShiftDefaults.date}
          defaultStartTime={createShiftDefaults.startTime}
          defaultEndTime={createShiftDefaults.endTime}
        />
      )}

      {user?.role === 'ADMIN' && (
        <>
          <SuggestShiftModal
            isOpen={suggestModalOpen}
            onClose={() => setSuggestModalOpen(false)}
            onSuccess={() => {
              setSuggestModalOpen(false);
              handleModalSuccess();
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
              handleModalSuccess();
            }}
          />

          <EditShiftModal
            isOpen={editModalOpen}
            shift={selectedShift}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedShift(null);
            }}
            onSuccess={() => {
              setEditModalOpen(false);
              setSelectedShift(null);
              handleModalSuccess();
            }}
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
        onSuccess={() => {
          setCancelModalOpen(false);
          setSelectedShift(null);
          handleModalSuccess();
        }}
        userRole={user?.role as 'ADMIN' | 'PA'}
      />
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
            <p className="text-sm text-gray-600">Time: {shift.start_time} - {shift.end_time} ({shift.duration_hours}h)</p>
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