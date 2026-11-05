import type { Deadline } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatDate, urgencyLabel, isOverdue } from '@/utils/date';
import { CheckCircle2, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Props {
  deadline: Deadline;
  onConfirm?: (deadline: Deadline) => void;
}

export function DeadlineCard({ deadline, onConfirm }: Props) {
  const effectiveDate = deadline.confirmedDate ?? deadline.computedDate;
  const overdue = isOverdue(effectiveDate) && deadline.status !== 'COMPLETED';

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        overdue
          ? 'border-rose-200 bg-rose-50/50 shadow-xs'
          : 'border-slate-200/90 bg-white shadow-xs hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs font-semibold text-slate-900 tracking-tight">
              {deadline.label}
            </span>
            <StatusBadge status={deadline.status} />
            {overdue && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Action Required
              </Badge>
            )}
          </div>

          {deadline.clause && (
            <div className="mt-2.5 border-l-2 border-slate-900 bg-slate-50 p-2.5 rounded-r-md text-[11px] font-mono text-slate-600 italic line-clamp-2 leading-relaxed">
              &ldquo;{deadline.clause.rawText}&rdquo;
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
              <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                {formatDate(effectiveDate)}
              </span>
            </div>

            <Badge variant={overdue ? 'destructive' : 'neutral'} className="text-[10px]">
              <Clock className="h-2.5 w-2.5 mr-0.5 text-slate-500" />
              {urgencyLabel(effectiveDate)}
            </Badge>

            <span className="text-[11px] capitalize text-slate-500 font-medium">
              {deadline.dayType.toLowerCase()} days
            </span>
          </div>
        </div>

        {(deadline.status === 'PENDING' || deadline.status === 'MISSED') && onConfirm && (
          <Button
            variant="default"
            size="xs"
            onClick={() => onConfirm(deadline)}
            className="shrink-0 self-start sm:self-center bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold rounded-full px-3 py-1.5 cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            <span>Confirm Date</span>
          </Button>
        )}
      </div>
    </div>
  );
}
