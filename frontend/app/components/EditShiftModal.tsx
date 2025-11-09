'use client';

import { useState, useEffect } from 'react';
import { shiftsAPI } from '@/lib/shifts-api';
import { parseDate, formatTime12Hour } from '@/app/components/calendar/utils';

interface EditShiftModalProps {
  isOpen: boolean;
  shift: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditShiftModal({
  isOpen,
  shift,
  onClose,
  onSuccess,
}: EditShiftModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    admin_notes: '',
  });

  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    if (isOpen && shift) {
      setMode('view');
      setFormData({
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        admin_notes: shift.admin_notes || '',
      });
      setDeleteReason('');
      setError('');
    }
  }, [isOpen, shift]);

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

    const handleUpdate = async () => {
    setError('');
    setLoading(true);

    try {
        await shiftsAPI.editShift(shift.id, {
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        admin_notes: formData.admin_notes,
        });
        onSuccess();
        onClose();
    } catch (err: any) {
        setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to update shift');
    } finally {
        setLoading(false);
    }
    };
  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      setError('Please provide a reason for deleting this shift');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await shiftsAPI.cancelRequest(shift.id, deleteReason);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete shift');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !shift) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-[9998]" 
          onClick={onClose} 
        />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[9999]">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {mode === 'view' && 'Shift Details'}
              {mode === 'edit' && 'Edit Shift'}
              {mode === 'delete' && 'Delete Shift'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {mode === 'view' && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">PA: {shift.requested_by_name || shift.pa_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Date: {parseDate(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Time: {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)} ({shift.duration_hours}h)
                  </p>
                  {shift.notes && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">PA Notes:</span> {shift.notes}
                    </p>
                  )}
                  {shift.admin_notes && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Admin Notes:</span> {shift.admin_notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => setMode('edit')}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Shift
                  </button>
                  <button
                    onClick={() => setMode('delete')}
                    className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Shift
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {mode === 'edit' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Duration:</span> {calculateDuration()} hours
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={formData.admin_notes}
                    onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                    rows={3}
                    placeholder="Any notes about this shift..."
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setMode('view');
                      setFormData({
                        date: shift.date,
                        start_time: shift.start_time,
                        end_time: shift.end_time,
                        admin_notes: shift.admin_notes || '',
                      });
                      setError('');
                    }}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === 'delete' && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-900">
                    Are you sure you want to delete this shift?
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    {shift.requested_by_name || shift.pa_name} • {parseDate(shift.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Deletion <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    placeholder="Please explain why this shift is being deleted..."
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleDelete}
                    disabled={loading || !deleteReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => {
                      setMode('view');
                      setDeleteReason('');
                      setError('');
                    }}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}