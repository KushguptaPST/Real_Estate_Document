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
          ? 'border-rose-500/30 bg-rose-500/5 shadow-lg'
          : 'border-white/[0.08] bg-[#141418] shadow-lg hover:border-[#C9A961]/30'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs font-semibold text-[#F5F5F7] tracking-tight">
              {deadline.label}
            </span>
            <StatusBadge status={deadline.status} />
            {overdue && (
              <Badge variant="destructive" className="text-[10px] bg-rose-500/15 text-rose-300 border-rose-500/25">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Action Required
              </Badge>
            )}
          </div>

          {deadline.clause && (
            <div className="mt-2.5 border-l-2 border-[#C9A961]/60 bg-[#0D0D11] p-2.5 rounded-r-md text-[11px] font-mono text-[#9A9AA5] italic line-clamp-2 leading-relaxed">
              &ldquo;{deadline.clause.rawText}&rdquo;
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-mono font-medium text-[#F5F5F7]">
              <Calendar className="h-3.5 w-3.5 text-[#C9A961]" />
              <span className={overdue ? 'text-rose-400 font-bold' : 'text-[#F5F5F7]'}>
                {formatDate(effectiveDate)}
              </span>
            </div>

            <Badge variant={overdue ? 'destructive' : 'neutral'} className="text-[10px] bg-white/[0.06] text-[#9A9AA5] border-white/[0.08]">
              <Clock className="h-2.5 w-2.5 mr-0.5 text-[#C9A961]" />
              {urgencyLabel(effectiveDate)}
            </Badge>

            <span className="text-[11px] capitalize text-[#6E6E7A] font-medium">
              {deadline.dayType.toLowerCase()} days
            </span>
          </div>
        </div>

        {deadline.status === 'PENDING' && onConfirm && (
          <Button
            variant="default"
            size="xs"
            onClick={() => onConfirm(deadline)}
            className="shrink-0 self-start sm:self-center bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold rounded-full px-3 py-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            <span>Confirm Date</span>
          </Button>
        )}
      </div>
    </div>
  );
}
