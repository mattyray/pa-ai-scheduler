'use client';

import { useState, useEffect } from 'react';
import { suggestionsAPI, CreateSuggestionData } from '@/lib/suggestions-api';
import { schedulesAPI } from '@/lib/schedules-api';
import { api } from '@/lib/api';

interface SuggestShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

interface PA {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export default function SuggestShiftModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDate = '',
  defaultStartTime = '06:00',
  defaultEndTime = '09:00',
}: SuggestShiftModalProps) {
  const [pas, setPAs] = useState<PA[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    suggested_to: '',
    schedule_period: '',
    date: defaultDate,
    start_time: defaultStartTime,
    end_time: defaultEndTime,
    message: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadPAs();
      loadPeriods();
    }
  }, [isOpen]);

  useEffect(() => {
    if (defaultDate) {
      setFormData(prev => ({ ...prev, date: defaultDate }));
    }
  }, [defaultDate]);

  const loadPAs = async () => {
    try {
      const response = await api.get('/api/auth/users/');
      const allUsers = response.data.results || response.data;
      const paUsers = allUsers.filter((u: any) => u.role === 'PA');
      setPAs(paUsers);
    } catch (err) {
      console.error('Failed to load PAs:', err);
    }
  };

  const loadPeriods = async () => {
    try {
      const response = await schedulesAPI.listPeriods();
      const periodsData = response.data.results || response.data;
      setPeriods(periodsData.filter((p: any) => p.status === 'OPEN' || p.status === 'LOCKED'));
      
      if (periodsData.length > 0 && !formData.schedule_period) {
        const openPeriod = periodsData.find((p: any) => p.status === 'OPEN');
        setFormData(prev => ({
          ...prev,
          schedule_period: String(openPeriod?.id || periodsData[0].id),
        }));
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    }
  };

  const calculateDuration = () => {
    if (!formData.start_time || !formData.end_time) return '0';
    
    const [startHour, startMin] = formData.start_time.split(':').map(Number);
    const [endHour, endMin] = formData.end_time.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    
    return (totalMinutes / 60).toFixed(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data: CreateSuggestionData = {
        suggested_to: parseInt(formData.suggested_to),
        schedule_period: parseInt(formData.schedule_period),
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        message: formData.message,
      };

      await suggestionsAPI.create(data);
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create suggestion');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      suggested_to: '',
      schedule_period: '',
      date: defaultDate,
      start_time: '06:00',
      end_time: '09:00',
      message: '',
    });
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggest Shift to PA</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select PA *
                  </label>
                  <select
                    required
                    value={formData.suggested_to}
                    onChange={(e) => setFormData({ ...formData, suggested_to: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a PA...</option>
                    {pas.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.first_name} {pa.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period *
                  </label>
                  <select
                    required
                    value={formData.schedule_period}
                    onChange={(e) => setFormData({ ...formData, schedule_period: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a period...</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} ({period.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  Duration: <span className="font-semibold">{calculateDuration()} hours</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message to PA (optional)
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                    placeholder="Can you cover the morning routine?"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Suggestion'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
