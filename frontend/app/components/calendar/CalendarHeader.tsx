'use client';

interface CalendarHeaderProps {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  viewType?: 'month' | 'week' | 'day';
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  showViewSwitcher?: boolean;
}

export default function CalendarHeader({
  title,
  onPrevious,
  onNext,
  onToday,
  viewType,
  onViewChange,
  showViewSwitcher = false,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      {showViewSwitcher && viewType && onViewChange && (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewChange('month')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              viewType === 'month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewChange('week')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              viewType === 'week'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onViewChange('day')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              viewType === 'day'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onPrevious}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous"
        >
          <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mx-4">{title}</h2>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToday}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}