'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { pasAPI, PADetail, Shift } from '@/lib/pas-api';

export default function PADetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAdmin, loading } = useAuth();
  const [pa, setPA] = useState<PADetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [maxHours, setMaxHours] = useState(40);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const paId = parseInt(params?.id as string);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/login');
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin && paId) {
      loadPADetail();
    }
  }, [isAdmin, paId]);

  const loadPADetail = async () => {
    try {
      setDataLoading(true);
      const response = await pasAPI.get(paId);
      setPA(response.data);
      setMaxHours(response.data.profile.max_hours_per_week);
      setNotes(response.data.profile.notes || '');
    } catch (err) {
      console.error('Failed to load PA details:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await pasAPI.updateProfile(paId, {
        max_hours_per_week: maxHours,
        notes: notes,
      });
      await loadPADetail();
      setEditingProfile(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading PA details...</p>
        </div>
      </div>
    );
  }

  if (!pa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">PA not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/pas')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to PAs
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {pa.first_name} {pa.last_name}
              </h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700">
                {user?.first_name} {user?.last_name}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Profile & Stats */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Basic Info Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{pa.email}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500">Phone</label>
                  <p className="text-sm text-gray-900">{pa.phone_number}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <div className="flex space-x-2 mt-1">
                    <span
                      className={`inline-flex text-xs px-2 py-1 rounded-full ${
                        pa.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pa.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {pa.is_email_verified ? (
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500">Date Joined</label>
                  <p className="text-sm text-gray-900">
                    {new Date(pa.date_joined).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                
                {pa.last_login && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Last Login</label>
                    <p className="text-sm text-gray-900">
                      {new Date(pa.last_login).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Settings Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                {!editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              
              {editingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Hours/Week
                    </label>
                    <input
                      type="number"
                      value={maxHours}
                      onChange={(e) => setMaxHours(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Internal notes about this PA..."
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProfile(false);
                        setMaxHours(pa.profile.max_hours_per_week);
                        setNotes(pa.profile.notes || '');
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Max Hours/Week</label>
                    <p className="text-sm text-gray-900">{pa.profile.max_hours_per_week}</p>
                  </div>
                  
                  {pa.profile.notes && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Notes</label>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{pa.profile.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Shifts</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {pa.stats.total_shifts_worked || 0}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Hours</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Number(pa.stats.total_hours_worked || 0).toFixed(1)}h
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Hours/Week</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Number(pa.stats.average_hours_per_week || 0).toFixed(1)}h
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Reliability Score</span>
                  <span className="text-sm font-semibold text-green-600">
                    {Number(pa.stats.reliability_score || 100).toFixed(1)}%
                  </span>
                </div>
                
                {pa.stats.last_worked_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Last Worked</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(pa.stats.last_worked_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Shifts */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Pending Requests */}
            {pa.pending_requests.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Pending Requests ({pa.pending_requests.length})
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {pa.pending_requests.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} status="pending" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Shifts */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Upcoming Shifts ({pa.upcoming_shifts.length})
                </h2>
              </div>
              <div className="p-6">
                {pa.upcoming_shifts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No upcoming shifts</p>
                ) : (
                  <div className="space-y-3">
                    {pa.upcoming_shifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} status="upcoming" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Shifts */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Shifts ({pa.recent_shifts.length})
                </h2>
              </div>
              <div className="p-6">
                {pa.recent_shifts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No recent shifts</p>
                ) : (
                  <div className="space-y-3">
                    {pa.recent_shifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} status="completed" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ShiftCard({ shift, status }: { shift: Shift; status: 'pending' | 'upcoming' | 'completed' }) {
  const statusColors = {
    pending: 'bg-yellow-100 border-yellow-300',
    upcoming: 'bg-blue-100 border-blue-300',
    completed: 'bg-green-100 border-green-300',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${statusColors[status]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {new Date(shift.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {shift.duration_hours}h • {shift.schedule_period_name}
          </p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-semibold rounded-full ${
            status === 'pending'
              ? 'bg-yellow-200 text-yellow-800'
              : status === 'upcoming'
              ? 'bg-blue-200 text-blue-800'
              : 'bg-green-200 text-green-800'
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
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