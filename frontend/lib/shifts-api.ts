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
  approved_by_name: string | null;
}

export interface CreateShiftRequestData {
  schedule_period: number;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export const shiftsAPI = {
  listRequests: () => 
    api.get<{ results: ShiftRequest[] }>('/api/shifts/requests/'),
  
  listShifts: () => 
    api.get<{ results: ShiftRequest[] }>('/api/shifts/requests/'),
  
  createRequest: (data: CreateShiftRequestData) => 
    api.post<ShiftRequest>('/api/shifts/requests/', data),
  
  getRequest: (id: number) => 
    api.get<ShiftRequest>(`/api/shifts/requests/${id}/`),
  
  approveRequest: (id: number, admin_notes?: string) => 
    api.post<ShiftRequest>(`/api/shifts/requests/${id}/approve/`, { admin_notes }),
  
  rejectRequest: (id: number, rejected_reason: string) => 
    api.post<ShiftRequest>(`/api/shifts/requests/${id}/reject/`, { rejected_reason }),
  
  cancelRequest: (id: number) => 
    api.post<ShiftRequest>(`/api/shifts/requests/${id}/cancel/`),
};
