import { api } from './api';

export interface ShiftRequest {
  id: number;
  schedule_period: number;
  schedule_period_name: string;
  requested_by: number;
  requested_by_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  notes: string;
  admin_notes: string;
  rejected_reason: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: number | null;
  approved_by_name: string;
}

export interface CreateShiftRequest {
  schedule_period: number;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export const shiftsAPI = {
  // List shifts (with filters)
  listShifts: (params?: {
    status?: string;
    period?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const queryString = new URLSearchParams(params as any).toString();
    return api.get(`/api/shifts/${queryString ? `?${queryString}` : ''}`);
  },

  // Get single shift
  getShift: (id: number) => api.get(`/api/shifts/${id}/`),

  // Create shift request (PA)
  createShiftRequest: (data: CreateShiftRequest) => 
    api.post('/api/shifts/', data),

  // Update shift request (own pending requests only)
  updateShiftRequest: (id: number, data: Partial<CreateShiftRequest>) => 
    api.patch(`/api/shifts/${id}/`, data),

  // Delete/cancel shift request
  deleteShiftRequest: (id: number) => 
    api.delete(`/api/shifts/${id}/`),

  // Get pending requests (admin only)
  getPendingRequests: () => 
    api.get('/api/shifts/pending/'),

  // Get my schedule (PA only)
  getMySchedule: () => 
    api.get('/api/shifts/my-schedule/'),

  // Approve shift (admin only)
  approveShift: (id: number, admin_notes?: string) => 
    api.post(`/api/shifts/${id}/approve/`, { admin_notes }),

  // Reject shift (admin only)
  rejectShift: (id: number, rejected_reason: string) => 
    api.post(`/api/shifts/${id}/reject/`, { rejected_reason }),
};
