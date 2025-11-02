import { api } from './api';

export interface ShiftSuggestion {
  id: number;
  suggested_by: number;
  suggested_by_name: string;
  suggested_to: number;
  suggested_to_name: string;
  schedule_period: number;
  schedule_period_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  message: string;
  decline_reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  related_shift_request: number | null;
  created_at: string;
  responded_at: string | null;
}

export interface CreateSuggestionData {
  suggested_to: number;
  schedule_period: number;
  date: string;
  start_time: string;
  end_time: string;
  message?: string;
}

export const suggestionsAPI = {
  list: () => api.get<ShiftSuggestion[]>('/api/shifts/suggestions/'),
  
  create: (data: CreateSuggestionData) => 
    api.post<ShiftSuggestion>('/api/shifts/suggestions/', data),
  
  get: (id: number) => 
    api.get<ShiftSuggestion>(`/api/shifts/suggestions/${id}/`),
  
  accept: (id: number) => 
    api.post<ShiftSuggestion>(`/api/shifts/suggestions/${id}/accept/`),
  
  decline: (id: number, reason?: string) => 
    api.post<ShiftSuggestion>(`/api/shifts/suggestions/${id}/decline/`, { decline_reason: reason }),
  
  delete: (id: number) => 
    api.delete(`/api/shifts/suggestions/${id}/`),
};
