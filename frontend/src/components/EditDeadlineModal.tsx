import { useState } from 'react';
import type { Deadline, DayType } from '@/types';
import { IconX, IconCheckCircle, IconCalendar, IconClock, IconExclamationTriangle } from './icons';
import { deadlinesApi } from '@/services/api';

interface Props {
  isOpen: boolean;
  deadline: Deadline | null;
  dealId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDeadlineModal({ isOpen, deadline, dealId, onClose, onSuccess }: Props) {
  if (!isOpen || !deadline) return null;

  const [date, setDate] = useState(
    (deadline.confirmedDate || deadline.computedDate).split('T')[0] || ''
  );
  const [dayType, setDayType] = useState<DayType>(deadline.dayType || 'calendar');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!deadline) return;
    try {
      await deadlinesApi.confirm(dealId, deadline.id, {
        confirmedDate: new Date(date).toISOString(),
        confirmedBy: 'Agent Reviewer',
        activate: true,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <IconCalendar className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-100">Edit &amp; Confirm Deadline</h3>
              <p className="text-xs text-slate-400">{deadline.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="banner-error">
            <IconExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="label">Confirmed Target Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input"
            />
          </div>

          <div>
            <label className="label">Day Type Calculation</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDayType('calendar')}
                className={`rounded-xl p-2.5 text-xs font-semibold border transition-all ${
                  dayType === 'calendar'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/40'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                Calendar Days
              </button>
              <button
                type="button"
                onClick={() => setDayType('business')}
                className={`rounded-xl p-2.5 text-xs font-semibold border transition-all ${
                  dayType === 'business'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/40'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                Business Days
              </button>
            </div>
          </div>

          {deadline.clause?.rawText && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block mb-1">Contract Raw Text Quote:</span>
              <p className="italic leading-relaxed text-slate-400">&ldquo;{deadline.clause.rawText}&rdquo;</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Saving...' : 'Confirm & Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
