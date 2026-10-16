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
          ? 'border-[#C9A961] bg-[#C9A961]/15 ring-1 ring-[#C9A961]/50 shadow-[0_0_20px_rgba(201,169,97,0.2)]'
          : 'border-white/10 hover:border-[#C9A961]/50 bg-[#14141C] hover:bg-[#1A1A24] shadow-sm hover:-translate-y-0.5'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-[#F5F5F7] min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#C9A961] text-[#0A0A0B] font-mono text-[10px] font-bold shadow-xs">
            {citation.id}
          </span>
          <span className="truncate text-[#F5F5F7] text-xs font-semibold">
            {isDoc
              ? citation.documentName || 'Contract Document'
              : isDeadline
              ? citation.deadlineLabel || 'Contingency Deadline'
              : 'Deal Record'}
          </span>
        </div>

        {citation.pageNumber && (
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[#A0A0B0]">
            Page {citation.pageNumber}
          </span>
        )}
      </div>

      {/* Section Header */}
      {citation.section && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#C9A961]">
          <span>&sect;</span>
          <span className="truncate">{citation.section}</span>
        </div>
      )}

      {/* Quoted Text Callout */}
      {citation.quote && (
        <div className="mt-2.5 border-l-2 border-l-[#C9A961] bg-[#0E0E14] p-3 rounded-r-xl text-[11px] font-mono text-[#D8D8E2] italic line-clamp-3 leading-relaxed border border-white/5 shadow-inner">
          &ldquo;{citation.quote}&rdquo;
        </div>
      )}

      {/* Bottom Status & Action */}
      <div className="mt-3 flex items-center justify-between text-[11px] pt-2.5 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          {citation.isConfirmed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              Verified Quote
            </span>
          )}
          {citation.isOcr && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              OCR
            </span>
          )}
        </div>

        <span className="text-[#C9A961] font-semibold group-hover:text-[#DFBF77] flex items-center gap-1 text-[11px] transition-colors">
          <span>Jump to Page</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}
