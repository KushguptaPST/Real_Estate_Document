import type { Deadline } from '@/types';
import { DeadlineCard } from './DeadlineCard';
import { FileText, Calendar } from 'lucide-react';

interface Props {
  deadlines: Deadline[];
  onConfirm?: (deadline: Deadline) => void;
}

export function Timeline({ deadlines, onConfirm }: Props) {
  if (deadlines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-xs">
        <div className="flex h-11 w-11 mx-auto items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-emerald-700 mb-3">
          <FileText className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-semibold text-slate-900">No Milestones Extracted Yet</h4>
        <p className="mt-1 text-[11px] text-slate-500 max-w-sm mx-auto">
          Upload a signed purchase agreement to automatically calculate contingency milestones and statutory banking day windows.
        </p>
      </div>
    );
  }

  const sorted = [...deadlines].sort(
    (a, b) =>
      new Date(a.confirmedDate ?? a.computedDate).getTime() -
      new Date(b.confirmedDate ?? b.computedDate).getTime(),
  );

  return (
    <ol className="relative ml-3 border-l border-slate-200 space-y-4">
      {sorted.map((dl) => (
        <li key={dl.id} className="ml-5 relative">
          <span className="absolute -left-[25px] top-5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-white shadow-xs" />
          <DeadlineCard deadline={dl} onConfirm={onConfirm} />
        </li>
      ))}
    </ol>
  );
}
