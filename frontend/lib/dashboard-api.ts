import { api } from './api';

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
  calendar_month: any; // Same format as month view
}

export const dashboardAPI = {
  // Get complete dashboard data
  getDashboardData: () => api.get<DashboardData>('/api/dashboard/'),
  
  // Get just stats
  getStats: () => api.get<DashboardStats>('/api/dashboard/stats/'),
  
  // Get today's shifts
  getTodayShifts: () => api.get<TodayShift[]>('/api/dashboard/today/'),
  
  // Get coverage gaps
  getCoverageGaps: () => api.get<CoverageGap[]>('/api/dashboard/gaps/'),
};
EOF# From frontend/ directory
cat > lib/dashboard-api.ts << 'EOF'
import { api } from './api';

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
  calendar_month: any; // Same format as month view
}

export const dashboardAPI = {
  // Get complete dashboard data
  getDashboardData: () => api.get<DashboardData>('/api/dashboard/'),
  
  // Get just stats
  getStats: () => api.get<DashboardStats>('/api/dashboard/stats/'),
  
  // Get today's shifts
  getTodayShifts: () => api.get<TodayShift[]>('/api/dashboard/today/'),
  
  // Get coverage gaps
  getCoverageGaps: () => api.get<CoverageGap[]>('/api/dashboard/gaps/'),
};
