import { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Badge } from './ui/badge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (count: number) => void;
  title?: string;
  type?: 'leads' | 'properties' | string;
}

export function CsvImportModal({ isOpen, onClose, title, type = 'leads' }: Props) {
  const displayTitle = title || (type === 'properties' ? 'Import Properties CSV / MLS' : 'Import Leads CSV / Excel');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="gold" className="text-[10px] mb-1">
              Feature Notice
            </Badge>
            <h3 className="text-base font-bold text-[#F5F5F7] flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#C9A961]" /> {displayTitle}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#6E6E7A] hover:text-[#F5F5F7] transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-amber-300">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#C9A961]" />
              <span>Bulk CSV Import Disabled</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Batch CSV / MLS file ingestion with multi-row validation, duplicate preview, and transactional error reporting is currently disabled to prevent unvalidated data mutations.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101014] p-4 space-y-2 text-[#9A9AA5]">
            <h4 className="font-bold text-[#F5F5F7] text-xs">Recommended Alternatives:</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-[#9A9AA5]">
              <li>Use the manual <strong className="text-[#F5F5F7]">Add {type === 'properties' ? 'Listing' : 'Lead'}</strong> modal for individual entries.</li>
              <li>Configure server-to-server <strong className="text-[#F5F5F7]">Inbound Webhook / API Key</strong> intake for automated ingestion.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1E1E26] hover:bg-[#282834] font-semibold text-[#F5F5F7] text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[#6E6E7A] font-semibold text-xs cursor-not-allowed"
            >
              Import Disabled
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
