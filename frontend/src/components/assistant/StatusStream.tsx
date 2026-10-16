import { IconSpinner, IconMagnifyingGlass, IconSparkles, IconCheckCircle } from '../icons';

interface Props {
  stage: 'retrieving' | 'reasoning' | 'verifying' | null;
  message?: string;
}

export function StatusStream({ stage, message }: Props) {
  if (!stage) return null;

  return (
    <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-[#C9A961]/25 bg-[#14141C]/90 backdrop-blur-md shadow-xl animate-pulse">
      {stage === 'retrieving' ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
          <IconMagnifyingGlass className="h-4 w-4 animate-bounce" />
        </div>
      ) : stage === 'reasoning' ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
          <IconSparkles className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
          <IconCheckCircle className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#F5F5F7]">
            {stage === 'retrieving'
              ? '1. Retrieving Contract Clauses & Addenda'
              : stage === 'reasoning'
              ? '2. Analyzing Precedence & Contingencies'
              : '3. Verifying Verbatim Quotes Server-Side'}
          </span>
          <IconSpinner className="h-3.5 w-3.5 animate-spin text-[#C9A961] shrink-0" />
        </div>
        {message ? (
          <p className="text-[11px] text-[#A0A0B0] mt-1 font-mono truncate">{message}</p>
        ) : (
          <p className="text-[11px] text-[#7A7A8A] mt-0.5">Grounding response against indexed PDF clauses...</p>
        )}
      </div>
    </div>
  );
}

