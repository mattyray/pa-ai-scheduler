export interface CalendarShift {
  id: number;
  pa_id?: number;
  requested_by: number;
  requested_by_name: string;
  pa_name?: string;
  pa_color?: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  admin_notes?: string;
  isOvernightContinuation?: boolean;
  originalDate?: string;
}

export interface CalendarDay {
  date: string;
  day_name: string;
  is_current_month: boolean;
  shifts: CalendarShift[];
  coverage?: {
    morning_covered: boolean;
    evening_covered: boolean;
  };
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface MonthViewData {
  year: number;
  month: number;
  weeks: CalendarWeek[];
}

export interface WeekViewData {
  year: number;
  week: number;
  days: CalendarDay[];
}

export interface DayViewData {
  date: string;
  day_name: string;
  shifts: CalendarShift[];
}