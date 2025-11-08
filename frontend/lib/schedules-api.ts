import { api } from './api';

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
  listPeriods: () => api.get<PaginatedResponse<SchedulePeriod>>('/api/schedule-periods/'),
  
  getPeriod: (id: number) => api.get(`/api/schedule-periods/${id}/`),
  
  createPeriod: (data: CreateSchedulePeriod) => 
    api.post('/api/schedule-periods/', data),
  
  updatePeriod: (id: number, data: Partial<CreateSchedulePeriod>) => 
    api.patch(`/api/schedule-periods/${id}/`, data),
  
  updatePeriodStatus: (id: number, status: string) =>
    api.patch(`/api/schedule-periods/${id}/`, { status }),
  
  deletePeriod: (id: number) => 
    api.delete(`/api/schedule-periods/${id}/`),
  
  finalizePeriod: (id: number) => 
    api.post(`/api/schedule-periods/${id}/finalize/`),
  
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