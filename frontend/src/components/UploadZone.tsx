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
      setTimeout(() => {
        onSuccess?.();
      }, 500);
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
          ? 'border-slate-900 bg-emerald-50/50 shadow-md scale-[1.01]'
          : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/40 shadow-xs'
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
            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 ring-4 ring-emerald-100'
            : uploading
            ? 'bg-emerald-50 border-slate-200 text-emerald-600 animate-pulse'
            : 'bg-slate-50 border-slate-200 text-emerald-700 group-hover:bg-emerald-50 group-hover:border-slate-200 group-hover:scale-110 shadow-xs'
        }`}
      >
        {success ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      {uploading ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-900 animate-fade-in">
            {stages[uploadStage]?.title}
          </p>
          <p className="text-xs text-slate-500">
            {stages[uploadStage]?.sub}
          </p>
          <div className="flex justify-center items-center gap-1.5 pt-1">
            {stages.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx <= uploadStage ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      ) : success ? (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-emerald-600">
            Upload &amp; ingestion complete
          </p>
          <p className="text-xs text-slate-500">
            Document indexed with deterministic citation embeddings.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">
            Drag and drop your contract PDF here, or{' '}
            <span className="text-emerald-700 font-semibold underline underline-offset-4 transition-colors group-hover:text-emerald-800">
              browse files
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Signed purchase agreements, counter-offers, addenda up to 50 MB
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono text-slate-600">
              NWMLS Form 21
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono text-slate-600">
              CAR RPA-CA
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono text-slate-600">
              TREC / State Forms
            </span>
            <span className="rounded-full border border-slate-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-mono text-emerald-800">
              100% Deterministic OCR
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
