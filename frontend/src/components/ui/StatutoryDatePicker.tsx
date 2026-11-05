import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';

export interface StatutoryDatePickerProps {
  value: string; // ISO date string: YYYY-MM-DD or empty
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Calculates Statutory Day 1 per standard US real estate law (e.g. Washington RCW 64.06 / NWMLS Form 21, CAR, TREC).
 * Day 0 is Mutual Acceptance Date.
 * Day 1 begins on the next business day (skips Saturday/Sunday).
 */
export function calculateStatutoryDayOne(dateStr: string): { formattedDayOne: string; explanation: string } | null {
  if (!dateStr) return null;
  try {
    const d0 = parseISO(dateStr);
    if (!isValid(d0)) return null;

    const nextDay = new Date(d0);
    nextDay.setDate(nextDay.getDate() + 1);
    const dow = nextDay.getDay(); // 0 = Sun, 6 = Sat

    if (dow === 6) {
      // Next day is Saturday -> Move to Monday (+2)
      nextDay.setDate(nextDay.getDate() + 2);
      return {
        formattedDayOne: format(nextDay, 'EEEE, MMM d, yyyy'),
        explanation: 'Excludes weekend per statutory practice (RCW 64.06)',
      };
    } else if (dow === 0) {
      // Next day is Sunday -> Move to Monday (+1)
      nextDay.setDate(nextDay.getDate() + 1);
      return {
        formattedDayOne: format(nextDay, 'EEEE, MMM d, yyyy'),
        explanation: 'Excludes Sunday per statutory practice',
      };
    }

    return {
      formattedDayOne: format(nextDay, 'EEEE, MMM d, yyyy'),
      explanation: 'Next business day begins at 12:00 AM (ends 9:00 PM)',
    };
  } catch {
    return null;
  }
}

export function StatutoryDatePicker({
  value,
  onChange,
  placeholder = 'Select Contract Mutual Acceptance Date (Day 0)...',
  className = '',
  disabled = false,
}: StatutoryDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected Date representation
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }, [value]);

  // Current calendar month view
  const [currentMonth, setCurrentMonth] = useState<Date>(() => selectedDate || new Date());

  // Update current month if external value changes to a valid date
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate);
    }
  }, [value]);

  // Handle outside clicks to close popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const handleSelectDay = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    onChange(format(today, 'yyyy-MM-dd'));
    setCurrentMonth(today);
    setIsOpen(false);
  };

  const handleSetYesterday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    onChange(format(yest, 'yyyy-MM-dd'));
    setCurrentMonth(yest);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const dayOneInfo = useMemo(() => calculateStatutoryDayOne(value), [value]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* ── Input Trigger ── */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full h-11 px-3.5 rounded-xl border bg-white flex items-center justify-between text-xs transition-all cursor-pointer shadow-2xs select-none ${isOpen
            ? 'border-emerald-700 ring-2 ring-emerald-700/15'
            : 'border-slate-200 hover:border-slate-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="h-4 w-4 text-emerald-700 shrink-0" />
          {selectedDate ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-slate-900">
                {format(selectedDate, 'EEEE, MMM d, yyyy')}
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                Day 0 Anchor
              </span>
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selectedDate && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear Date"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <CalendarDays className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* ── Dropdown Calendar Popover ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 mt-2 z-50 w-full sm:w-[360px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-4 space-y-3.5"
          >
            {/* Popover Header: Month / Year & Navigation */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                aria-label="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <h4 className="text-sm font-bold text-slate-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Mutual Acceptance Day 0</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                aria-label="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60 text-[11px] font-semibold">
              <button
                type="button"
                onClick={handleSetToday}
                className="flex-1 py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-800 hover:text-emerald-800 hover:border-emerald-300 transition-colors cursor-pointer text-center shadow-2xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="flex-1 py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-800 hover:text-emerald-800 hover:border-emerald-300 transition-colors cursor-pointer text-center shadow-2xs"
              >
                Yesterday
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="py-1 px-2.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Weekday Labels (Sun - Sat) */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-slate-400">
              <span className="text-amber-600/70">Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span className="text-amber-600/70">Sa</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
              {calendarDays.map((day, idx) => {
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`h-9 w-full rounded-xl flex items-center justify-center font-medium transition-all cursor-pointer relative ${isSelected
                        ? 'bg-emerald-700 text-white font-bold shadow-xs ring-2 ring-emerald-700/20'
                        : isCurrentDay
                          ? 'border border-emerald-600 text-emerald-800 font-bold bg-emerald-50/60 hover:bg-emerald-100'
                          : !isCurrentMonth
                            ? 'text-slate-300 hover:bg-slate-50'
                            : isWeekend
                              ? 'text-slate-600 hover:bg-slate-100 font-medium'
                              : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-900'
                      }`}
                  >
                    <span>{format(day, 'd')}</span>
                    {isCurrentDay && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Statutory Day 1 Live Feedback Footer */}
            <div className="pt-2 border-t border-slate-100">
              {dayOneInfo ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span>Statutory Day 1 Begins: {dayOneInfo.formattedDayOne}</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 font-medium leading-tight">
                    {dayOneInfo.explanation}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium p-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Select mutual acceptance date to anchor statutory contingency calculation.</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

