import { MessageSquare, ArrowRight } from 'lucide-react';

interface Props {
  suggestions: string[];
  onSelect: (question: string) => void;
  loading?: boolean;
}

export function SuggestedQuestions({ suggestions, onSelect, loading = false }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 tracking-wider uppercase">
        <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
        <span>Context-Aware Suggestions</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((question, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => onSelect(question)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xs disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 group-hover:scale-125 transition-all shrink-0" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 leading-relaxed truncate-2-lines">
                {question}
              </span>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 group-hover:border-slate-300 group-hover:bg-slate-200 text-slate-400 group-hover:text-slate-900 transition-all shrink-0">
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
