'use client';

import { getPAColor } from '@/lib/pa-colors';
import { parseDate, isOvernightShift, getNextDay, formatTime12Hour, isToday } from './utils';
import type { WeekViewData, CalendarShift } from './types';

interface WeekViewProps {
  data: WeekViewData | null;
  onDayHeaderClick?: (date: string) => void;
  onEmptySlotClick?: (date: string, hour: number) => void;
  onShiftClick?: (shift: CalendarShift) => void;
  userId?: number;
  isAdmin?: boolean;
}

export default function WeekView({
  data,
  onDayHeaderClick,
  onEmptySlotClick,
  onShiftClick,
  userId,
  isAdmin = false,
}: WeekViewProps) {
  if (!data || !data.days) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Loading week view...</p>
      </div>
    );
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getShiftsCoveringHour = (dayDate: string, hour: number, dayShifts: CalendarShift[]) => {
    const allShifts: CalendarShift[] = [];
    
    (dayShifts || []).forEach(shift => {
      const [startHour] = shift.start_time.split(':').map(Number);
      const [endHour] = shift.end_time.split(':').map(Number);

      if (isOvernightShift(shift)) {
        if (hour >= startHour) {
          allShifts.push(shift);
        }
      } else {
        if (hour >= startHour && hour < endHour) {
          allShifts.push(shift);
        }
      }
    });

    data.days.forEach((day) => {
      if (day.date !== dayDate) {
        (day.shifts || []).forEach((shift) => {
          if (isOvernightShift(shift) && getNextDay(shift.date) === dayDate) {
            const [endHour] = shift.end_time.split(':').map(Number);
            if (hour < endHour) {
              allShifts.push({
                ...shift,
                isOvernightContinuation: true,
                originalDate: shift.date
              });
            }
          }
        });
      }
    });

    return allShifts;
  };

  const getShiftHeight = (shift: CalendarShift, currentHour: number): number => {
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);

    if (shift.isOvernightContinuation) {
      if (currentHour === 0) {
        return Math.min(endHour * 60 + endMin, 60);
      } else if (currentHour < endHour) {
        return 60;
      } else if (currentHour === endHour) {
        return endMin;
      }
      return 0;
    }

    if (isOvernightShift(shift)) {
      if (currentHour >= startHour) {
        if (currentHour === startHour) {
          return 60 - startMin;
        }
        return 60;
      }
      return 0;
    }

    if (currentHour === startHour && currentHour === endHour - 1) {
      return (endHour * 60 + endMin) - (startHour * 60 + startMin);
    } else if (currentHour === startHour) {
      return 60 - startMin;
    } else if (currentHour === endHour - 1) {
      return endMin || 60;
    } else if (currentHour > startHour && currentHour < endHour - 1) {
      return 60;
    }

    return 60;
  };

  const getShiftTopOffset = (shift: CalendarShift, currentHour: number): number => {
    const [startHour, startMin] = shift.start_time.split(':').map(Number);

    if (shift.isOvernightContinuation) {
      return 0;
    }

    if (currentHour === startHour) {
      return startMin;
    }

    return 0;
  };

  const handleCellClick = (date: string, hour: number, shifts: CalendarShift[]) => {
    if (shifts.length > 0) {
      if (onShiftClick) {
        onShiftClick(shifts[0]);
      }
    } else {
      if (onEmptySlotClick) {
        onEmptySlotClick(date, hour);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="grid grid-cols-[80px_repeat(7,minmax(120px,1fr))] border-b border-gray-200">
            <div className="sticky left-0 bg-gray-50 border-r border-gray-200 p-3 font-semibold text-sm text-gray-700 z-10">
              Time
            </div>
            {data.days.map((day, idx) => {
              const date = parseDate(day.date);
              const today = isToday(day.date);

              return (
                <button
                  key={idx}
                  onClick={() => onDayHeaderClick && onDayHeaderClick(day.date)}
                  className={`p-3 text-center border-r border-gray-200 transition-colors hover:bg-gray-100 ${
                    today ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <div className={`font-semibold text-sm ${today ? 'text-blue-600' : 'text-gray-900'}`}>
                    {dayNames[date.getDay()]}
                  </div>
                  <div className={`text-xs mt-1 ${today ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[80px_repeat(7,minmax(120px,1fr))] border-b border-gray-100"
                style={{ minHeight: '60px' }}
              >
                <div className="sticky left-0 bg-white border-r border-gray-200 p-2 text-xs text-gray-500 z-10">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>

                {data.days.map((day, dayIdx) => {
                  const shiftsInHour = getShiftsCoveringHour(day.date, hour, day.shifts || []);
                  
                  return (
                    <div
                      key={dayIdx}
                      onClick={() => handleCellClick(day.date, hour, shiftsInHour)}
                      className={`relative border-r border-gray-100 transition-colors ${
                        shiftsInHour.length > 0 ? 'cursor-pointer hover:bg-gray-50' : 'cursor-pointer hover:bg-blue-50'
                      }`}
                      style={{ minHeight: '60px' }}
                    >
                      {shiftsInHour.map((shift, shiftIdx) => {
                        const height = getShiftHeight(shift, hour);
                        const topOffset = getShiftTopOffset(shift, hour);
                        
                        if (height === 0) return null;

                        const isFirstSegment = shift.isOvernightContinuation 
                          ? hour === 0
                          : hour === parseInt(shift.start_time.split(':')[0]);

                        return (
                          <div
                            key={`${shift.id}-${shiftIdx}`}
                            className="absolute inset-x-0 px-1 group"
                            style={{
                              top: `${topOffset}px`,
                              height: `${height}px`,
                            }}
                          >
                            <div
                              className="h-full rounded shadow-sm border-l-4 p-1.5 overflow-hidden transition-all group-hover:shadow-md"
                              style={{
                                backgroundColor: getPAColor(shift.requested_by) + '20',
                                borderLeftColor: getPAColor(shift.requested_by),
                              }}
                            >
                              {isFirstSegment && (
                                <div className="text-xs">
                                  <div className="font-semibold text-gray-900 truncate">
                                    {shift.requested_by_name || shift.pa_name}
                                  </div>
                                  <div className="text-gray-600 text-[10px]">
                                    {formatTime12Hour(shift.start_time)}
                                    {shift.isOvernightContinuation && (
                                      <span className="ml-1 text-purple-600">
                                        (from {parseDate(shift.originalDate || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Click day headers to view day details, or click time slots to {isAdmin ? 'suggest' : 'request'} shifts
        </p>
      </div>
    </div>
  );
}