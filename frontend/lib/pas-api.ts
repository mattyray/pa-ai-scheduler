import { api } from './api';

export interface PA {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_email_verified: boolean;
  is_active: boolean;
  date_joined: string;
  max_hours_per_week: number;
  total_shifts: number;
  total_hours: number;
  reliability_score: number;
  last_worked_date: string | null;
}

export interface PADetail extends PA {
  username: string;
  last_login: string | null;
  profile: {
    preferred_start_time: string | null;
    preferred_end_time: string | null;
    preferred_days: string[];
    max_hours_per_week: number;
    notes: string;
  };
  stats: {
    total_shifts_worked: number;
    total_hours_worked: number;
    average_hours_per_week: number;
    most_common_days: Record<string, number>;
    most_common_start_time: string | null;
    most_common_shift_length: number | null;
    preferred_shift_pattern: string;
    reliability_score: number;
    typical_request_timing: number | null;
    consecutive_days_preference: number | null;
    last_worked_date: string | null;
    last_calculated: string;
  };
  recent_shifts: Shift[];
  upcoming_shifts: Shift[];
  pending_requests: Shift[];
}

export interface Shift {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  schedule_period_name: string;
  created_at?: string;
}

export const pasAPI = {
  // List all PAs
  list: () => api.get<PA[]>('/api/auth/pas/'),
  
  // Get individual PA details
  get: (id: number) => api.get<PADetail>(`/api/auth/pas/${id}/`),
  
  // Update PA profile (max hours, notes)
  updateProfile: (userId: number, data: { max_hours_per_week?: number; notes?: string }) =>
    api.patch(`/api/auth/pas/${userId}/profile/`, data),
  
  // Get PA shift history with filters
  getShiftHistory: (id: number, params?: { status?: string; start_date?: string; end_date?: string }) =>
    api.get(`/api/auth/pas/${id}/shift-history/`, { params }),
};