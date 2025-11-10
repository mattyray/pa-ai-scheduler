import { apiClient } from './api';

export interface DashboardStats {
  pending_requests: number;
  coverage_gaps: number;
  total_shifts: number;
  active_pas: number;
}

export interface TodayShift {
  id: number;
  pa_name: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface CoverageGap {
  date: string;
  time_slot: 'morning' | 'evening';
  date_formatted: string;
}

export interface DashboardData {
  stats: DashboardStats;
  today_shifts: TodayShift[];
  coverage_gaps: CoverageGap[];
  calendar_month: any;
}

export const dashboardAPI = {
  getDashboardData: () => apiClient.get<DashboardData>('/api/dashboard/'),
  getStats: () => apiClient.get<DashboardStats>('/api/dashboard/stats/'),
  getTodayShifts: () => apiClient.get<TodayShift[]>('/api/dashboard/today/'),
  getCoverageGaps: () => apiClient.get<CoverageGap[]>('/api/dashboard/gaps/'),
};