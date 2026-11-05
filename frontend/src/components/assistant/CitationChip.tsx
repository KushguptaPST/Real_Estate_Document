import type { Citation } from '@/types';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  citation: Citation;
  onClick?: (citation: Citation) => void;
  isActive?: boolean;
}

export function CitationChip({ citation, onClick, isActive = false }: Props) {
  const isDoc = citation.sourceType === 'document';
  const isDeadline = citation.sourceType === 'deadline';

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className={`group text-left p-3.5 rounded-2xl border transition-all duration-200 text-xs w-full block cursor-pointer ${
        isActive
          ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs'
          : 'border-slate-200/90 hover:border-slate-300 bg-slate-50/70 hover:bg-white shadow-2xs hover:-translate-y-0.5'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] text-white font-mono text-[10px] font-bold shadow-xs">
            {citation.id}
          </span>
          <span className="truncate text-slate-900 text-xs font-semibold">
            {isDoc
              ? citation.documentName || 'Contract Document'
              : isDeadline
              ? citation.deadlineLabel || 'Contingency Deadline'
              : 'Deal Record'}
          </span>
        </div>

        {citation.pageNumber && (
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 shadow-2xs">
            Page {citation.pageNumber}
          </span>
        )}
      </div>

      {/* Section Header */}
      {citation.section && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
          <span>&sect;</span>
          <span className="truncate">{citation.section}</span>
        </div>
      )}

      {/* Quoted Text Callout */}
      {citation.quote && (
        <div className="mt-2.5 border-l-2 border-l-emerald-600 bg-white p-3 rounded-r-xl text-[11px] font-mono text-slate-700 italic line-clamp-3 leading-relaxed border border-slate-200/70 shadow-2xs">
          &ldquo;{citation.quote}&rdquo;
        </div>
      )}

      {/* Bottom Status & Action */}
      <div className="mt-3 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {citation.isConfirmed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-0.5 text-emerald-600" />
              Verified Quote
            </span>
          )}
          {citation.isOcr && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              OCR
            </span>
          )}
        </div>

        <span className="text-emerald-800 font-semibold group-hover:text-emerald-950 flex items-center gap-1 text-[11px] transition-colors">
          <span>Jump to Page</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}
