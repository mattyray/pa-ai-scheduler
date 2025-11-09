'use client';

import { getPAColor } from '@/lib/pa-colors';
import { formatTime12Hour, formatHour12, isOvernightShift, parseDate } from './utils';
import type { DayViewData, CalendarShift } from './types';

interface DayViewProps {
  data: DayViewData | null;
  onEmptySlotClick?: (date: string, hour: number) => void;
  onShiftClick?: (shift: CalendarShift) => void;
  userId?: number;
  isAdmin?: boolean;
}

export default function DayView({
  data,
  onEmptySlotClick,
  onShiftClick,
  userId,
  isAdmin = false,
}: DayViewProps) {
  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Loading day view...</p>
      </div>
    );
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const allShifts = data.shifts || [];
  const shifts = isAdmin ? allShifts : allShifts.filter(s => s.requested_by === userId);

  const getShiftsCoveringHour = (hour: number) => {
    return shifts.filter((shift) => {
      const startHour = parseInt(shift.start_time.split(':')[0]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      const endMinute = parseInt(shift.end_time.split(':')[1]);
      const overnight = isOvernightShift(shift);
      
      if (overnight) {
        return startHour <= hour || (endHour > hour || (endHour === hour && endMinute > 0));
      }
      
      return startHour <= hour && (endHour > hour || (endHour === hour && endMinute > 0));
    });
  };

  const handleCellClick = (hour: number) => {
    const coveringShifts = getShiftsCoveringHour(hour);
    if (coveringShifts.length > 0) {
      const shift = coveringShifts[0];
      if (onShiftClick) {
        onShiftClick(shift);
      }
      return;
    }
    
    if (onEmptySlotClick) {
      onEmptySlotClick(data.date, hour);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <h3 className="text-lg font-semibold text-gray-900">{data.day_name}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <div className="relative">
        {hours.map((hour) => {
          const isCriticalTime = (hour >= 6 && hour < 9) || (hour >= 21 && hour < 22);
          const shiftsStartingThisHour = shifts.filter((shift) => {
            const startHour = parseInt(shift.start_time.split(':')[0]);
            return hour === startHour;
          });
          
          const shiftsCoveringThisHour = getShiftsCoveringHour(hour);
          const hasShiftCoverage = shiftsCoveringThisHour.length > 0;

          return (
            <div
              key={hour}
              className={`flex border-b border-gray-100 ${
                isCriticalTime ? 'bg-yellow-50/30' : ''
              }`}
            >
              <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-100 w-24 flex-shrink-0">
                {formatHour12(hour)}
              </div>

              <div 
                className={`relative p-2 min-h-[3rem] flex-1 ${
                  hasShiftCoverage
                    ? 'cursor-pointer hover:bg-blue-50/50 transition-colors'
                    : 'cursor-pointer hover:bg-blue-50 transition-colors'
                }`}
                onClick={() => handleCellClick(hour)}
                title={
                  hasShiftCoverage
                    ? 'Click to manage shift'
                    : (isAdmin ? 'Click to suggest shift' : 'Click to request shift')
                }
              >
                {shiftsStartingThisHour.map((shift) => {
                  const paName = shift.requested_by_name || shift.pa_name || 'Unknown';
                  const paId = shift.requested_by || shift.id;
                  const color = getPAColor(paId);
                  const isPending = shift.status === 'PENDING';
                  const overnight = isOvernightShift(shift);
                  const durationHours = parseFloat(shift.duration_hours || '1');

                  return (
                    <div
                      key={shift.id}
                      className={`absolute inset-x-2 rounded-lg px-4 py-2 shadow-md flex flex-col justify-between transition-all ${
                        isPending 
                          ? 'border-2 border-dashed hover:scale-105' 
                          : 'text-white hover:opacity-80'
                      }`}
                      style={isPending ? {
                        backgroundColor: color + '30',
                        borderColor: color,
                        color: color,
                        top: '0.5rem',
                        height: `${Math.max(durationHours * 3, 3)}rem`,
                        pointerEvents: 'auto',
                        zIndex: 10,
                      } : {
                        backgroundColor: color,
                        color: '#fff',
                        top: '0.5rem',
                        height: `${Math.max(durationHours * 3, 3)}rem`,
                        pointerEvents: 'auto',
                        zIndex: 10,
                      }}
                    >
                      <div>
                        <div className="font-bold text-base">
                          {isPending && '⏳ '}
                          {overnight && '🌙 '}
                          {paName}
                          {isPending && <span className="ml-2 text-xs font-normal">(Pending)</span>}
                          {overnight && <span className="ml-2 text-xs font-normal">(Overnight)</span>}
                        </div>
                        <div className="text-sm opacity-90 mt-1">{formatTime12Hour(shift.start_time)}</div>
                      </div>
                      <div className="text-sm opacity-90 text-right font-medium">{formatTime12Hour(shift.end_time)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> {isAdmin
            ? 'Click on any time slot to suggest a shift, or click on a shift to manage it'
            : 'Click on any time slot to request a shift, or click on your shifts to cancel them'}
        </p>
      </div>
    </div>
  );
}