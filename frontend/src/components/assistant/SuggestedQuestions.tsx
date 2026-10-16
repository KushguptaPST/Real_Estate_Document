import { Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  suggestions: string[];
  onSelect: (question: string) => void;
  loading?: boolean;
}

export function SuggestedQuestions({ suggestions, onSelect, loading = false }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F7] tracking-wider uppercase">
        <Sparkles className="h-3.5 w-3.5 text-[#C9A961]" />
        <span>Context-Aware Suggestions</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((question, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => onSelect(question)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#161622]/90 hover:bg-[#1C1C2C] hover:border-[#C9A961]/50 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(201,169,97,0.12)] disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-1.5 w-1.5 rounded-full bg-[#C9A961]/60 group-hover:bg-[#C9A961] group-hover:scale-125 transition-all shrink-0" />
              <span className="text-xs font-medium text-[#D8D8E2] group-hover:text-white leading-relaxed truncate-2-lines">
                {question}
              </span>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 border border-white/10 group-hover:border-[#C9A961]/40 group-hover:bg-[#C9A961]/15 text-[#7A7A8A] group-hover:text-[#C9A961] transition-all shrink-0">
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
