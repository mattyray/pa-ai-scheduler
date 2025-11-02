'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schedulesAPI, SchedulePeriod } from '@/lib/schedules-api';
import { shiftsAPI } from '@/lib/shifts-api';

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
      
      // Only show OPEN periods
      const openPeriods = Array.isArray(periodsData) 
        ? periodsData.filter((p: SchedulePeriod) => p.status === 'OPEN')
        : [];
      
      setPeriods(openPeriods);
      
      // Auto-select first open period
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

    try {
      await shiftsAPI.createShiftRequest({
        schedule_period: parseInt(formData.schedule_period),
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || undefined,
      });

      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/requests');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to create request:', err);
      
      if (err.response?.data) {
        const errorData = err.response.data;
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full">
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Shift request submitted successfully!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Your request has been sent to the administrator for approval.</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/requests')}
                    className="text-sm font-medium text-green-800 hover:text-green-600"
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
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

      {/* Main Content */}
      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Info Box */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Shift Request Guidelines</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Shifts should be at least 8 hours (exceptions allowed)</li>
                    <li>Critical times: 6-9 AM (morning) and 9-10 PM (evening) must be covered</li>
                    <li>Check the schedule to avoid conflicts</li>
                    <li>Requests are first-come, first-served</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white shadow rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
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
                  {/* Schedule Period */}
                  <div>
                    <label htmlFor="schedule_period" className="block text-sm font-medium text-gray-700">
                      Schedule Period *
                    </label>
                    <select
                      id="schedule_period"
                      required
                      value={formData.schedule_period}
                      onChange={(e) => setFormData({ ...formData, schedule_period: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      {periods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name} ({new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                      Shift Date *
                    </label>
                    <input
                      type="date"
                      id="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={periods.find(p => p.id.toString() === formData.schedule_period)?.start_date}
                      max={periods.find(p => p.id.toString() === formData.schedule_period)?.end_date}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      id="start_time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                      End Time *
                    </label>
                    <input
                      type="time"
                      id="end_time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  {/* Duration Display */}
                  {formData.start_time && formData.end_time && (
                    <div className="rounded-md bg-gray-50 p-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Duration:</span>{' '}
                        {calculateDuration(formData.start_time, formData.end_time)} hours
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Any additional information about this shift..."
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading || periods.length === 0}
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

// Helper function to calculate duration
function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let hours = endHour - startHour;
  let minutes = endMin - startMin;
  
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  }
  
  if (hours < 0) {
    hours += 24; // Handle overnight shifts
  }
  
  return hours + (minutes / 60);
}
