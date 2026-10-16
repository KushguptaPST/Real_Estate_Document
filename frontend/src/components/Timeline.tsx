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
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#141418] p-10 text-center">
        <div className="flex h-11 w-11 mx-auto items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#C9A961] mb-3">
          <FileText className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-semibold text-[#F5F5F7]">No Milestones Extracted Yet</h4>
        <p className="mt-1 text-[11px] text-[#9A9AA5] max-w-sm mx-auto">
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
    <ol className="relative ml-3 border-l border-white/10 space-y-4">
      {sorted.map((dl) => (
        <li key={dl.id} className="ml-5 relative">
          <span className="absolute -left-[25px] top-4.5 h-2.5 w-2.5 rounded-full bg-[#C9A961] ring-4 ring-[#141418] shadow-[0_0_10px_rgba(201,169,97,0.5)]" />
          <DeadlineCard deadline={dl} onConfirm={onConfirm} />
        </li>
      ))}
    </ol>
  );
}
