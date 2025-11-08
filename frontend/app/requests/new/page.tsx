'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI, SchedulePeriod } from '@/lib/schedules-api';
import { shiftsAPI } from '@/lib/shifts-api';

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

export default function NewShiftRequestPage() {
  const router = useRouter();
  const { user, isPA, loading: authLoading, logout } = useAuth();

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [formData, setFormData] = useState({
    schedule_period: '',
    date: '',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isPA) {
      router.push('/login');
    }
  }, [authLoading, isPA, router]);

  useEffect(() => {
    if (user) {
      loadPeriods();
    }
  }, [user]);

  const loadPeriods = async () => {
    try {
      const response = await schedulesAPI.listPeriods();
      const periodsData = response.data.results || response.data;
      
      const openPeriods = Array.isArray(periodsData) 
        ? periodsData.filter((p: SchedulePeriod) => p.status === 'OPEN')
        : [];
      
      setPeriods(openPeriods);
      
      if (openPeriods.length > 0) {
        setFormData(prev => ({ ...prev, schedule_period: openPeriods[0].id.toString() }));
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const requestData = {
      schedule_period: parseInt(formData.schedule_period),
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      notes: formData.notes || undefined,
    };
    
    console.log('📤 Sending shift request:', requestData);

    try {
      const response = await shiftsAPI.createRequest(requestData);
      console.log('✅ Success:', response.data);
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/requests');
      }, 2000);
    } catch (err: any) {
      console.error('❌ Failed to create request:', err);
      console.error('📋 Full error:', err.response);
      
      if (err.response?.data) {
        const errorData = err.response.data;
        console.log('🔍 Backend error details:', errorData);
        
        if (typeof errorData === 'object') {
          const errorMessages = Object.entries(errorData)
            .map(([field, messages]) => {
              if (Array.isArray(messages)) {
                return `${field}: ${messages.join(', ')}`;
              }
              return `${field}: ${messages}`;
            })
            .join('\n');
          setError(errorMessages);
        } else {
          setError(String(errorData));
        }
      } else {
        setError('Failed to submit request. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const duration = calculateDuration(formData.start_time, formData.end_time);
  const isOvernight = duration.isOvernight;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full">
          <div className="rounded-lg bg-white shadow-xl p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Shift request submitted!
                </h3>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Your request has been sent to the administrator for approval.</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/requests')}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View my requests →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Submit Shift Request</h1>
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

      <main className="max-w-3xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold">Shift Request Guidelines</h3>
                <ul className="mt-2 space-y-1 text-sm text-blue-100">
                  <li>• Shifts should be at least 8 hours (exceptions allowed)</li>
                  <li>• Critical times: 6-9 AM (morning) and 9-10 PM (evening)</li>
                  <li>• Overnight shifts are supported (e.g., 6 PM to 9 AM)</li>
                  <li>• Requests are first-come, first-served</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
                      <p className="text-sm text-red-700 mt-2 whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {periods.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No open periods</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    There are no open schedule periods available for requests at this time.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="schedule_period" className="block text-sm font-semibold text-gray-700 mb-2">
                      Schedule Period *
                    </label>
                    <select
                      id="schedule_period"
                      required
                      value={formData.schedule_period}
                      onChange={(e) => setFormData({ ...formData, schedule_period: e.target.value })}
                      className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-3 px-4 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base cursor-pointer hover:border-blue-400 transition-colors"
                    >
                      {periods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name} ({parseDate(period.start_date).toLocaleDateString()} - {parseDate(period.end_date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="date" className="block text-sm font-semibold text-gray-700 mb-2">
                      Shift Date * <span className="text-xs font-normal text-gray-500">(Click anywhere to select date)</span>
                    </label>
                    <div 
                      onClick={() => dateRef.current?.showPicker()}
                      className="relative cursor-pointer"
                    >
                      <input
                        ref={dateRef}
                        type="date"
                        id="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        min={periods.find(p => p.id.toString() === formData.schedule_period)?.start_date}
                        max={periods.find(p => p.id.toString() === formData.schedule_period)?.end_date}
                        className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-4 px-4 text-gray-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                        style={{ colorScheme: 'light' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="start_time" className="block text-sm font-semibold text-gray-700 mb-2">
                        Start Time * <span className="text-xs font-normal text-gray-500">(Click to select)</span>
                      </label>
                      <div 
                        onClick={() => startTimeRef.current?.showPicker()}
                        className="relative cursor-pointer"
                      >
                        <input
                          ref={startTimeRef}
                          type="time"
                          id="start_time"
                          required
                          value={formData.start_time}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-4 px-4 text-gray-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                          style={{ colorScheme: 'light' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="end_time" className="block text-sm font-semibold text-gray-700 mb-2">
                        End Time * <span className="text-xs font-normal text-gray-500">(Click to select)</span>
                      </label>
                      <div 
                        onClick={() => endTimeRef.current?.showPicker()}
                        className="relative cursor-pointer"
                      >
                        <input
                          ref={endTimeRef}
                          type="time"
                          id="end_time"
                          required
                          value={formData.end_time}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-4 px-4 text-gray-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                          style={{ colorScheme: 'light' }}
                        />
                      </div>
                    </div>
                  </div>

                  {formData.start_time && formData.end_time && (
                    <div className={`rounded-lg p-4 ${isOvernight ? 'bg-purple-50 border-2 border-purple-300' : 'bg-blue-50 border-2 border-blue-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-bold text-gray-900">
                            Duration: {duration.hours.toFixed(2)} hours
                          </p>
                          {isOvernight && (
                            <p className="text-sm text-purple-600 font-medium mt-1">
                              🌙 This is an overnight shift
                            </p>
                          )}
                        </div>
                        {duration.hours >= 8 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800">
                            ✓ Meets minimum
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                            ⚠ Under 8 hours
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="block w-full border-2 border-gray-300 rounded-lg shadow-sm py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base hover:border-blue-400 transition-colors"
                      placeholder="Any additional information about this shift..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading || periods.length === 0}
                      className="flex-1 inline-flex justify-center items-center py-4 px-6 border border-transparent shadow-lg text-lg font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="inline-flex justify-center items-center py-4 px-6 border-2 border-gray-300 shadow-sm text-lg font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function calculateDuration(startTime: string, endTime: string): { hours: number; isOvernight: boolean } {
  if (!startTime || !endTime) return { hours: 0, isOvernight: false };

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let hours = endHour - startHour;
  let minutes = endMin - startMin;
  
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  }
  
  let isOvernight = false;
  
  if (hours < 0) {
    hours += 24;
    isOvernight = true;
  }
  
  const totalHours = hours + (minutes / 60);
  
  return { hours: totalHours, isOvernight };
}