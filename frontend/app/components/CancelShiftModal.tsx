'use client';

import { useState } from 'react';
import { shiftsAPI, ShiftRequest } from '@/lib/shifts-api';

interface CancelShiftModalProps {
  isOpen: boolean;
  shift: ShiftRequest | null;
  onClose: () => void;
  onSuccess: () => void;
  userRole?: 'ADMIN' | 'PA';
}

export default function CancelShiftModal({
  isOpen,
  shift,
  onClose,
  onSuccess,
  userRole,
}: CancelShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;

    setLoading(true);

    try {
      await shiftsAPI.cancelRequest(shift.id, cancellationReason);
      onSuccess();
      onClose();
      setCancellationReason('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel shift');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !shift) return null;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const calculateDuration = () => {
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }
    
    return (totalMinutes / 60).toFixed(1);
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-[9998]" 
          onClick={onClose} 
        />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-[9999]">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Cancel Shift
                  </h3>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-4">
                      Are you sure you want to cancel this shift?
                    </p>

                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                      <p className="text-sm"><strong>PA:</strong> {shift.requested_by_name}</p>
                      <p className="text-sm"><strong>Date:</strong> {formatDate(shift.date)}</p>
                      <p className="text-sm"><strong>Time:</strong> {formatTime(shift.start_time)} - {formatTime(shift.end_time)}</p>
                      <p className="text-sm"><strong>Duration:</strong> {calculateDuration()} hours</p>
                    </div>

                    <p className="text-xs text-gray-600 mb-4">
                      {userRole === 'ADMIN' 
                        ? `This will notify ${shift.requested_by_name}.`
                        : 'This will notify the admin and may create a coverage gap.'
                      }
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for cancellation (optional)
                      </label>
                      <textarea
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        rows={3}
                        placeholder="Personal emergency, scheduling conflict, etc..."
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Cancelling...' : 'Cancel Shift'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                Nevermind
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}