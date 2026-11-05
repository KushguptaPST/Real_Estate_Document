import { IconSpinner, IconMagnifyingGlass, IconCheckCircle } from '../icons';

interface Props {
  stage: 'retrieving' | 'reasoning' | 'verifying' | null;
  message?: string;
}

export function StatusStream({ stage, message }: Props) {
  if (!stage) return null;

  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-xs animate-pulse">
      {stage === 'retrieving' ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-700 border border-slate-200 shrink-0">
          <IconMagnifyingGlass className="h-4 w-4 animate-bounce" />
        </div>
      ) : stage === 'reasoning' ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-700 border border-slate-200 shrink-0">
          <IconSpinner className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
          <IconCheckCircle className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            {stage === 'retrieving'
              ? '1. Retrieving Contract Clauses & Addenda'
              : stage === 'reasoning'
              ? '2. Analyzing Precedence & Contingencies'
              : '3. Verifying Verbatim Quotes Server-Side'}
          </span>
          <IconSpinner className="h-3.5 w-3.5 animate-spin text-emerald-700 shrink-0" />
        </div>
        {message ? (
          <p className="text-[11px] text-slate-600 mt-1 font-mono truncate">{message}</p>
        ) : (
          <p className="text-[11px] text-emerald-800 mt-0.5">Grounding response against indexed PDF clauses...</p>
        )}
      </div>
    </div>
  );
}

