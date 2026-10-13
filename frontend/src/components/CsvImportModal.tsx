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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] mb-1">
              Feature Notice
            </Badge>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> {displayTitle}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Bulk CSV Import Disabled</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Batch CSV / MLS file ingestion with multi-row validation, duplicate preview, and transactional error reporting is currently disabled to prevent unvalidated data mutations.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-slate-600">
            <h4 className="font-bold text-slate-800 text-xs">Recommended Alternatives:</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
              <li>Use the manual <strong>Add {type === 'properties' ? 'Listing' : 'Lead'}</strong> modal for individual entries.</li>
              <li>Configure server-to-server <strong>Inbound Webhook / API Key</strong> intake for automated ingestion.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs"
            >
              Close
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed"
            >
              Import Disabled
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
