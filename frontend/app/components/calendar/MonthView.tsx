'use client';

import { getPAColor } from '@/lib/pa-colors';
import { parseDate, isOvernightShift, getNextDay, formatTime12Hour, isToday } from './utils';
import type { MonthViewData, CalendarShift } from './types';

interface MonthViewProps {
  data: MonthViewData | null;
  onDayClick?: (date: string) => void;
  onShiftClick?: (shift: CalendarShift) => void;
  userId?: number;
  isAdmin?: boolean;
  showCoverage?: boolean;
}

export default function MonthView({
  data,
  onDayClick,
  onShiftClick,
  userId,
  isAdmin = false,
  showCoverage = false,
}: MonthViewProps) {
  if (!data || !data.weeks) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Loading calendar...</p>
      </div>
    );
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getShiftsForDay = (dayDate: string, dayShifts: CalendarShift[]) => {
    if (isAdmin || !userId) {
      return dayShifts || [];
    }

    const myShifts = (dayShifts || []).filter((s) => s.requested_by === userId);
    
    const overnightContinuations: CalendarShift[] = [];
    data.weeks.forEach((week) => {
      week.days.forEach((day) => {
        if (day.shifts) {
          day.shifts.forEach((shift) => {
            if (
              shift.requested_by === userId &&
              isOvernightShift(shift) &&
              getNextDay(shift.date) === dayDate
            ) {
              overnightContinuations.push({
                ...shift,
                isOvernightContinuation: true,
              });
            }
          });
        }
      });
    });
    
    return [...myShifts, ...overnightContinuations];
  };

  const getCoverageColor = (coverage: any): string => {
    if (!coverage) return 'bg-red-50 border-red-200';
    if (coverage.morning_covered && coverage.evening_covered) return 'bg-green-50 border-green-200';
    if (coverage.morning_covered || coverage.evening_covered) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getCoverageBorder = (coverage: any): string => {
    if (!coverage) return 'border-l-4 border-l-red-400';
    if (coverage.morning_covered && coverage.evening_covered) return 'border-l-4 border-l-green-500';
    if (coverage.morning_covered || coverage.evening_covered) return 'border-l-4 border-l-yellow-500';
    return 'border-l-4 border-l-red-400';
  };

  const isShiftClickable = (shift: CalendarShift): boolean => {
    if (!onShiftClick) return false;
    if (shift.status === 'PENDING' && isAdmin) return true;
    if (shift.status === 'APPROVED' && isAdmin) return true;
    if (shift.status === 'APPROVED' && shift.requested_by === userId) return true;
    return false;
  };

  if (isAdmin && showCoverage) {
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {data.weeks.map((week, weekIdx) =>
            week.days.map((day, dayIdx) => {
              const date = parseDate(day.date);
              const today = isToday(day.date);
              const coverageColor = getCoverageColor(day.coverage);

              return (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() => day.is_current_month && onDayClick && onDayClick(day.date)}
                  className={`aspect-square p-2 rounded-md text-sm font-medium border-2 transition-all ${
                    !day.is_current_month 
                      ? 'text-gray-300 bg-gray-50 border-gray-100 cursor-default' 
                      : `${coverageColor} hover:shadow-md cursor-pointer`
                  } ${today ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`${today ? 'text-blue-600 font-bold' : 'text-gray-900'} ${!day.is_current_month ? 'text-gray-300' : ''}`}>
                      {date.getDate()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-green-100 border-2 border-green-300 rounded"></div>
            <span>Full Coverage</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
            <span>Partial</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-red-100 border-2 border-red-300 rounded"></div>
            <span>No Coverage</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {data.weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
          {week.days.map((day, dayIndex) => {
            const date = parseDate(day.date);
            const today = isToday(day.date);

            const allShiftsForDay = getShiftsForDay(day.date, day.shifts || []);
            const hasApproved = allShiftsForDay.some((s) => s.status === 'APPROVED' && !s.isOvernightContinuation);
            const hasPending = allShiftsForDay.some((s) => s.status === 'PENDING' && !s.isOvernightContinuation);
            const hasOvernightStart = allShiftsForDay.some((s) => !s.isOvernightContinuation && isOvernightShift(s));
            const hasOvernightContinuation = allShiftsForDay.some((s) => s.isOvernightContinuation);

            let statusColor = 'bg-white border-gray-200';
            if (hasApproved) {
              statusColor = 'bg-green-50 border-green-300';
            } else if (hasPending) {
              statusColor = 'bg-yellow-50 border-yellow-300';
            }

            return (
              <button
                key={dayIndex}
                onClick={() => day.is_current_month && onDayClick && onDayClick(day.date)}
                disabled={!day.is_current_month}
                className={`aspect-square p-2 text-sm border-2 rounded-lg transition-all ${statusColor} ${
                  !day.is_current_month 
                    ? 'text-gray-300 bg-gray-50 border-gray-100 cursor-default' 
                    : 'hover:shadow-md cursor-pointer'
                } ${today ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={`${today ? 'text-blue-600 font-bold' : 'text-gray-900'} ${!day.is_current_month ? 'text-gray-300' : ''}`}>
                    {date.getDate()}
                  </span>
                  {day.is_current_month && allShiftsForDay.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap justify-center">
                      {hasApproved && (
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      )}
                      {hasPending && (
                        <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                      )}
                      {hasOvernightStart && (
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      )}
                      {hasOvernightContinuation && (
                        <div className="w-1.5 h-1.5 bg-purple-300 rounded-full"></div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-600">
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 bg-green-50 border-2 border-green-300 rounded"></div>
          <span>Approved</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 bg-yellow-50 border-2 border-yellow-300 rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
          <span>Overnight</span>
        </div>
      </div>
    </div>
  );
}