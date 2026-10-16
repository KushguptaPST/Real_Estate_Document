import { useState, useRef } from 'react';
import { documentsApi } from '@/services/api';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Loader2 } from 'lucide-react';

interface Props {
  dealId: string;
  onSuccess?: () => void;
}

export function UploadZone({ dealId, onSuccess }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stages = [
    { title: 'Uploading & reading contract PDF...', sub: 'Fast-path local text extraction' },
    { title: 'Extracting clauses & milestone tasks...', sub: 'Parallel Gemini 2.5/3.5 Flash AI pipeline' },
    { title: 'Computing legal deadlines & statutory calendars...', sub: 'Deterministic WA/CA legal date engine' },
  ];

  async function uploadFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }

    setUploading(true);
    setUploadStage(0);
    setError(null);
    setSuccess(false);

    const interval = setInterval(() => {
      setUploadStage((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 1200);

    try {
      await documentsApi.upload(dealId, file);
      clearInterval(interval);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      clearInterval(interval);
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void uploadFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
        dragging
          ? 'border-[#C9A961] bg-[#C9A961]/10 shadow-[0_0_35px_rgba(201,169,97,0.25)] scale-[1.01]'
          : 'border-white/15 bg-gradient-to-b from-[#141418] to-[#0E0E12] hover:border-[#C9A961]/50 hover:bg-[#181822] shadow-xl hover:shadow-[0_0_30px_rgba(201,169,97,0.12)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />

      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 ${
          success
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 ring-4 ring-emerald-500/10'
            : uploading
            ? 'bg-[#C9A961]/20 border-[#C9A961]/40 text-[#C9A961] animate-pulse'
            : 'bg-white/5 border-white/10 text-[#C9A961] group-hover:bg-[#C9A961]/15 group-hover:border-[#C9A961]/40 group-hover:scale-110 shadow-lg'
        }`}
      >
        {success ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#C9A961]" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      {uploading ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-[#F5F5F7] animate-fade-in">
            {stages[uploadStage]?.title}
          </p>
          <p className="text-xs text-[#9A9AA5]">
            {stages[uploadStage]?.sub}
          </p>
          <div className="flex justify-center items-center gap-1.5 pt-1">
            {stages.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx <= uploadStage ? 'w-8 bg-[#C9A961]' : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      ) : success ? (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-emerald-400">
            Upload &amp; ingestion complete
          </p>
          <p className="text-xs text-[#9A9AA5]">
            Document indexed with deterministic citation embeddings.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-[#F5F5F7]">
            Drag and drop your contract PDF here, or{' '}
            <span className="text-[#C9A961] font-semibold underline underline-offset-4 transition-colors group-hover:text-[#DFBF77]">
              browse files
            </span>
          </p>
          <p className="text-xs text-[#9A9AA5]">
            Signed purchase agreements, counter-offers, addenda up to 50 MB
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono text-[#9A9AA5]">
              NWMLS Form 21
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono text-[#9A9AA5]">
              CAR RPA-CA
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono text-[#9A9AA5]">
              TREC / State Forms
            </span>
            <span className="rounded-full border border-[#C9A961]/25 bg-[#C9A961]/10 px-2.5 py-0.5 text-[10px] font-mono text-[#C9A961]">
              100% Deterministic OCR
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
