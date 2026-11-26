import { useRef, useState } from 'react';
import { FileText, Upload, Loader2, X, ExternalLink, Link2 } from 'lucide-react';
import { propertiesApi } from '@/services/api';
import { useToast } from '@/context/ToastContext';

interface BrochureUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  className?: string;
}

/**
 * Shared property brochure PDF uploader + optional external link input.
 */
export function BrochureUploadField({ value, onChange, className = '' }: BrochureUploadFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState('');
  const [showUrlMode, setShowUrlMode] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Invalid file type', 'Please select a PDF brochure file (.pdf).');
      return;
    }

    try {
      setUploading(true);
      const res = await propertiesApi.uploadBrochure(file);
      onChange(res.url);
      setUploadedName(res.filename || file.name);
      setShowUrlMode(false);
      toast.success(`Brochure "${file.name}" uploaded`);
    } catch (err: any) {
      toast.error('PDF upload failed', err.message || 'Could not upload brochure PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-700">
          Property Brochure PDF <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <button
          type="button"
          onClick={() => setShowUrlMode((prev) => !prev)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <Link2 className="h-3 w-3" />
          <span>{showUrlMode ? 'Switch to file upload' : 'Or paste PDF URL'}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {showUrlMode ? (
        <input
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setUploadedName('');
          }}
          placeholder="https://example.com/project-brochure.pdf"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
        />
      ) : value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate font-semibold text-emerald-950">
              {uploadedName || 'Brochure PDF attached'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
            >
              <span>View</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setUploadedName('');
              }}
              aria-label="Remove brochure PDF"
              className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-400 px-3.5 py-3 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-slate-700" />
              <span>Uploading PDF brochure...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-slate-600" />
              <span>Upload Property Brochure PDF (.pdf, max 50MB)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
