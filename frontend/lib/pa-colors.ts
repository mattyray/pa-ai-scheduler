// PA Color Assignment System
// Each PA gets a unique, consistent color across all views

const PA_COLORS = [
  '#3B82F6', // Blue
  '#9333EA', // Purple
  '#10B981', // Green
  '#F59E0B', // Orange
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EF4444', // Red
  '#EAB308', // Yellow
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
];

export function getPAColor(paId: number): string {
  return PA_COLORS[paId % PA_COLORS.length];
}

export function getPAColorWithAlpha(paId: number, alpha: number = 0.2): string {
  const hex = getPAColor(paId).slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Get lighter version for backgrounds
export function getPAColorLight(paId: number): string {
  return getPAColorWithAlpha(paId, 0.15);
}

// Get darker version for borders
export function getPAColorDark(paId: number): string {
  return getPAColorWithAlpha(paId, 0.4);
}

// Helper to check if shift is overnight
export function isOvernightShift(startTime: string, endTime: string): boolean {
  return endTime < startTime;
}

// Helper to split overnight shift into two visual blocks
export function splitOvernightShift(shift: any): [any, any] {
  return [
    {
      ...shift,
      end_time: '23:59',
      label: 'continues',
      is_overnight_first: true,
    },
    {
      ...shift,
      date: getNextDay(shift.date),
      start_time: '00:00',
      label: 'continued from previous day',
      is_overnight_second: true,
    },
  ];
}

// Get next day date string
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}
