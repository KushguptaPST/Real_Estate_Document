import { useState } from 'react';
import type { ContingencyClause, Deadline } from '@/types';
import { PdfViewer } from './pdf/PdfViewer';
import {
  IconX,
  IconDocumentText,
  IconSparkles,
  IconShieldCheck,
  IconCheckCircle,
  IconClock,
  IconEye,
  IconDownload,
  IconChevronLeft,
  IconChevronRight,
} from './icons';
import { formatDate } from '@/utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propertyAddress: string;
  deadlines: Deadline[];
}

export function DocumentInspectorModal({
  isOpen,
  onClose,
  propertyAddress,
  deadlines,
}: Props) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!isOpen) return null;

  const currentDeadline = deadlines[activeTab] || deadlines[0];
  const clause = currentDeadline?.clause;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-fadeIn">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <IconDocumentText className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Document Reader &amp; AI Inspector</h2>
                <span className="badge-emerald text-[10px]">OCR Parsed</span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">{propertyAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-400">
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                className="px-1.5 hover:text-white"
              >
                -
              </button>
              <span className="w-12 text-center text-slate-200">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="px-1.5 hover:text-white"
              >
                +
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Split View Content */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left Column: PdfViewer */}
          <div className="flex flex-col border-r border-slate-800 bg-slate-950/60 p-4 lg:col-span-7 overflow-hidden">
            <PdfViewer
              fileUrl=""
              initialPage={clause?.pageNumber || 3}
              highlightQuote={clause?.rawText || currentDeadline?.clause?.rawText}
            />
          </div>

          {/* Right Column: Clause Breakdown & AI Reasoning */}
          <div className="flex flex-col bg-slate-900 p-6 lg:col-span-5 overflow-y-auto space-y-6">
            <div>
              <span className="page-eyebrow mb-2">AI Extraction Inspector</span>
              <h3 className="text-lg font-bold text-slate-100">Contingency Breakdown</h3>
              <p className="text-xs text-slate-400">Select an extracted clause to inspect detailed calculation &amp; verification rules.</p>
            </div>

            {/* Clause Selector Tabs */}
            <div className="space-y-2">
              {deadlines.map((d, idx) => (
                <button
                  key={d.id}
                  onClick={() => setActiveTab(idx)}
                  className={`w-full text-left rounded-xl p-3 border transition-all flex items-center justify-between ${
                    activeTab === idx
                      ? 'border-brand-500 bg-brand-500/10 text-white shadow-md ring-1 ring-brand-500/30'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-slate-200">{d.label}</p>
                    <p className="text-[11px] text-slate-500">
                      Due: {formatDate(d.confirmedDate || d.computedDate)}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    d.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {d.status}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Clause Deep-Dive */}
            {currentDeadline && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    AI Logic &amp; Date Calculation
                  </h4>
                  <span className="badge-emerald text-[11px]">
                    <IconShieldCheck className="h-3.5 w-3.5" />
                    Verified Rule
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Computed Date</span>
                    <span className="font-semibold text-white">{formatDate(currentDeadline.computedDate)}</span>
                  </div>
                  <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Day Rule Type</span>
                    <span className="font-semibold text-brand-400 capitalize">{currentDeadline.dayType} days</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">State Holiday Adjustment Logic</span>
                  <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                    If computed deadline falls on a weekend or California official state holiday, execution rolls forward to 5:00 PM on the next business day pursuant to Civil Code Section 11.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
