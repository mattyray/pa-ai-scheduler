import { apiClient } from './api';

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
  cancellation_reason?: string;
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

export interface EditShiftData {
  date: string;
  start_time: string;
  end_time: string;
  admin_notes?: string;
}

export const shiftsAPI = {
  listRequests: () => 
    apiClient.get<{ results: ShiftRequest[] }>('/api/shifts/requests/'),
  
  listShifts: () => 
    apiClient.get<{ results: ShiftRequest[] }>('/api/shifts/requests/'),
  
  createRequest: (data: CreateShiftRequestData) => 
    apiClient.post<ShiftRequest>('/api/shifts/requests/', data),
  
  getRequest: (id: number) => 
    apiClient.get<ShiftRequest>(`/api/shifts/requests/${id}/`),
  
  approveRequest: (id: number, admin_notes?: string) => 
    apiClient.post<ShiftRequest>(`/api/shifts/requests/${id}/approve/`, { admin_notes }),
  
  rejectRequest: (id: number, rejected_reason: string) => 
    apiClient.post<ShiftRequest>(`/api/shifts/requests/${id}/reject/`, { rejected_reason }),
  
  editShift: (id: number, data: EditShiftData) => 
    apiClient.patch<ShiftRequest>(`/api/shifts/requests/${id}/edit/`, data),
  
  cancelRequest: (id: number, cancellation_reason?: string) => 
    apiClient.post<ShiftRequest>(`/api/shifts/requests/${id}/cancel/`, { cancellation_reason }),
};