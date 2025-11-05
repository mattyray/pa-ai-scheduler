import { api } from './api';

// Paginated response from Django REST Framework
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SchedulePeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'LOCKED' | 'FINALIZED';
  created_by: number;
  created_by_name: string;
  shift_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSchedulePeriod {
  name: string;
  start_date: string;
  end_date: string;
}

export const schedulesAPI = {
  // List all periods - returns paginated response
  listPeriods: () => api.get<PaginatedResponse<SchedulePeriod>>('/api/schedule-periods/'),
  
  // Get single period details
  getPeriod: (id: number) => api.get(`/api/schedule-periods/${id}/`),
  
  // Create new period (admin only)
  createPeriod: (data: CreateSchedulePeriod) => 
    api.post('/api/schedule-periods/', data),
  
  // Update period (admin only)
  updatePeriod: (id: number, data: Partial<CreateSchedulePeriod>) => 
    api.patch(`/api/schedule-periods/${id}/`, data),
  
  // Delete period (admin only)
  deletePeriod: (id: number) => 
    api.delete(`/api/schedule-periods/${id}/`),
  
  // Finalize period (admin only)
  finalizePeriod: (id: number) => 
    api.post(`/api/schedule-periods/${id}/finalize/`),
  
  // Calendar views
  getMonthView: (year: number, month: number, paId?: number) => {
    const params = paId ? `?pa_id=${paId}` : '';
    return api.get(`/api/calendar/month/${year}/${month}/${params}`);
  },
  
  getWeekView: (year: number, week: number, paId?: number) => {
    const params = paId ? `?pa_id=${paId}` : '';
    return api.get(`/api/calendar/week/${year}/${week}/${params}`);
  },
  
  getDayView: (date: string, paId?: number) => {
    const params = paId ? `?pa_id=${paId}` : '';
    return api.get(`/api/calendar/day/${date}/${params}`);
  },
};