export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

export function isOvernightShift(shift: any): boolean {
  return shift.end_time < shift.start_time;
}

export function getNextDay(dateStr: string): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

export function getPreviousDay(dateStr: string): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatHour12(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hours12 = hour % 12 || 12;
  return `${hours12}:00 ${period}`;
}

export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }
  
  return totalMinutes / 60;
}

export function getSundayBasedWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  
  const daysSinceSunday = (jan1.getDay() + 0) % 7;
  const firstWeekStart = new Date(jan1);
  firstWeekStart.setDate(jan1.getDate() - daysSinceSunday);
  
  const diffTime = d.getTime() - firstWeekStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNo = Math.floor(diffDays / 7) + 1;
  
  return { year, week: weekNo };
}

export function getISOWeek(date: Date): { year: number; week: number } {
  return getSundayBasedWeek(date);
}

export function isToday(dateStr: string): boolean {
  const date = parseDate(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}