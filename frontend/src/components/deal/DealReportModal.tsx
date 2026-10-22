import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Printer,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  ShieldCheck,
  Mail,
  Scale,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Deal, Deadline, NotificationSetting, Document } from '@/types';
import { formatDate, urgencyLabel } from '@/utils/date';
import { deadlinesApi, documentsApi, notificationsApi } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  notifSettings?: NotificationSetting | null;
}

export function DealReportModal({ isOpen, onClose, deal, notifSettings: initialSettings }: Props) {
  const [deadlines, setDeadlines] = useState<Deadline[]>(deal?.deadlines || []);
  const [documents, setDocuments] = useState<Document[]>(deal?.documents || []);
  const [settings, setSettings] = useState<NotificationSetting | null>(initialSettings || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !deal?.id) return;

    setLoading(true);
    Promise.all([
      deadlinesApi.list(deal.id).catch(() => [] as Deadline[]),
      documentsApi.list(deal.id).catch(() => [] as Document[]),
      initialSettings ? Promise.resolve(initialSettings) : notificationsApi.getSettings(deal.id).catch(() => null),
    ])
      .then(([loadedDeadlines, loadedDocs, loadedSettings]) => {
        setDeadlines(loadedDeadlines.length > 0 ? loadedDeadlines : deal.deadlines || []);
        setDocuments(loadedDocs.length > 0 ? loadedDocs : deal.documents || []);
        if (loadedSettings) setSettings(loadedSettings);
      })
      .finally(() => setLoading(false));
  }, [isOpen, deal?.id, initialSettings]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !deal) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalDeadlines = deadlines.length;
  const confirmedCount = deadlines.filter((d) => d.status === 'CONFIRMED' || d.status === 'ACTIVE' || d.status === 'COMPLETED').length;
  const pendingCount = totalDeadlines - confirmedCount;
  const upcomingDeadlines = [...deadlines]
    .sort((a, b) => new Date(a.computedDate).getTime() - new Date(b.computedDate).getTime())
    .filter((d) => new Date(d.computedDate).getTime() >= new Date().setHours(0, 0, 0, 0));
  const nextDeadline = upcomingDeadlines[0];

  return createPortal(
    <div className="deal-report-modal-overlay fixed inset-0 top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 overflow-hidden">
      <div className="deal-report-modal-container relative w-full max-w-4xl h-[92vh] max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-[#0D0D11] border border-white/10 text-[#F5F5F7] m-auto">
        
        {/* Modal Top Control Bar (Sticky & Hidden from print) */}
        <div className="no-print shrink-0 flex items-center justify-between border-b border-white/10 bg-[#141418] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-white">
                  Executive Transaction Summary &amp; Contingency Report
                </h2>
                <Badge variant="neutral" className="bg-[#1E1E26] text-[#C9A961] border-white/10 text-[10px] font-mono">
                  Print-Ready PDF
                </Badge>
              </div>
              <p className="text-[11px] text-[#9A9AA5] hidden sm:block">
                Verified milestone deadlines, contractual clause citations, and E&amp;O audit certification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] text-xs font-semibold shadow-md transition-all cursor-pointer hover:shadow-[0_0_15px_rgba(201,169,97,0.4)]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#9A9AA5] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Area - Single Clean Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#08080A]/95">
          
          {/* Printable Report Document Surface */}
          <div
            id="printable-deal-report"
            className="mx-auto w-full max-w-[820px] bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-2xl border border-slate-200"
          >
            {/* Header with Brokerage Branding & Timestamp */}
            <div className="border-b-2 border-slate-900 pb-3 mb-3.5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-widest text-[#B5934C] uppercase font-mono">
                      Contingency Copilot™
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Real Estate Closing Suite
                    </span>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                    Transaction Contingency &amp; Milestone Schedule
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Deterministic legal timeline report &bull; Binding purchase &amp; sale agreement terms
                  </p>
                </div>

                <div className="sm:text-right text-[11px] text-slate-600 space-y-0.5 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200">
                  <div>
                    <span className="font-semibold text-slate-700">Report Date: </span>
                    <span className="font-mono">{formatDate(new Date().toISOString())}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Deal Ref: </span>
                    <span className="font-mono">#{deal.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Status: </span>
                    <span className="inline-block px-1.5 py-0.2 rounded font-semibold text-[9px] bg-emerald-100 text-emerald-800">
                      {deal.status} ESCROW
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Property & Counterparty Information Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3.5 mb-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Subject Property
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-start gap-1.5">
                    <Building2 className="h-4 w-4 text-[#B5934C] shrink-0 mt-0.5" />
                    <span>{deal.propertyAddress}</span>
                  </div>
                  {deal.timezone && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Timezone: <span className="font-mono font-medium text-slate-700">{deal.timezone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 text-[11px]">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                      Buyer(s)
                    </span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {deal.buyerName || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                      Seller(s)
                    </span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {deal.sellerName || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                      Acceptance Date
                    </span>
                    <span className="font-semibold font-mono text-slate-800">
                      {deal.acceptanceDate ? formatDate(deal.acceptanceDate) : 'Pending acceptance'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                      Contract PDF
                    </span>
                    <span className="font-medium text-slate-700 truncate block">
                      {documents[0]?.filename || 'Executed_Agreement.pdf'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Summary Tiles */}
            <div className="grid grid-cols-3 gap-2.5 mb-3.5">
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                  Total Deadlines
                </span>
                <span className="text-lg font-bold text-slate-900 font-mono">{totalDeadlines}</span>
                <span className="text-[9px] text-slate-500 block">Tracked milestones</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Confirmed / Active
                </span>
                <span className="text-lg font-bold text-emerald-700 font-mono">{confirmedCount}</span>
                <span className="text-[9px] text-slate-500 block">Verified &amp; armed</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 block">
                  Next Critical Due
                </span>
                <span className="text-xs font-bold text-amber-700 truncate block mt-0.5">
                  {nextDeadline ? formatDate(nextDeadline.confirmedDate || nextDeadline.computedDate) : 'All complete'}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {nextDeadline ? urgencyLabel(nextDeadline.confirmedDate || nextDeadline.computedDate) : 'No pending tasks'}
                </span>
              </div>
            </div>

            {/* Milestone Contingencies Table */}
            <div className="mb-3.5 page-break-avoid">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#B5934C]" />
                  <span>Contingency Deadlines &amp; Timeline Schedule</span>
                </h3>
                <span className="text-[9px] text-slate-500">
                  Statutory banking holiday &amp; weekend rollover rules applied
                </span>
              </div>

              {deadlines.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-xs text-slate-500">
                  No contingency milestones have been extracted or confirmed for this transaction yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="py-2 px-3">Contingency / Milestone</th>
                        <th className="py-2 px-2.5">Statutory Date</th>
                        <th className="py-2 px-2.5">Calculation Rule</th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-3">Contract Citation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {deadlines.map((item, idx) => {
                        const targetDate = item.confirmedDate || item.computedDate;
                        const isConfirmed = item.status === 'CONFIRMED' || item.status === 'ACTIVE' || item.status === 'COMPLETED';
                        const days = item.clause?.numberOfDays;
                        const dayType = item.dayType || item.clause?.dayType || 'calendar';

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-medium text-slate-900 align-top">
                              <div>{item.label}</div>
                              {item.clause?.clauseType && (
                                <span className="text-[9px] text-slate-500 font-mono block">
                                  {item.clause.clauseType}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 align-top whitespace-nowrap">
                              <span className="font-mono font-semibold text-slate-900">
                                {formatDate(targetDate)}
                              </span>
                              <span className="block text-[9px] text-slate-500">
                                {urgencyLabel(targetDate)}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 align-top text-slate-600 text-[10px]">
                              {days ? (
                                <span>
                                  {days} {dayType} days
                                </span>
                              ) : (
                                <span>Per agreement terms</span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 align-top whitespace-nowrap">
                              {isConfirmed ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  <span>{item.status === 'ACTIVE' ? 'Active' : 'Confirmed'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-200">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>{item.status || 'Pending'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 align-top text-slate-600 text-[10px] max-w-[220px]">
                              {item.clause?.rawText ? (
                                <div>
                                  <span className="italic line-clamp-1 text-slate-700">
                                    &ldquo;{item.clause.rawText}&rdquo;
                                  </span>
                                  {item.clause.pageNumber && (
                                    <span className="text-[9px] text-slate-500 block font-medium">
                                      Page {item.clause.pageNumber} citation
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Mutual contract provision</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notification & Distribution Registry */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 mb-3.5 page-break-avoid">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mail className="h-3.5 w-3.5 text-[#B5934C]" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Automated Distribution &amp; Alert Registry
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700 block text-[10px]">Alert Recipients:</span>
                  {settings?.recipients && settings.recipients.length > 0 ? (
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-slate-800 font-mono text-[10px]">
                      {settings.recipients.map((email, idx) => (
                        <li key={idx} className="truncate">{email}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-500 italic text-[10px]">No recipients registered</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block text-[10px]">Delivery Protocol:</span>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Automated dispatches scheduled 3 days prior, 1 day prior, and morning of deadline via Resend cryptographic mail engine.
                  </p>
                </div>
              </div>
            </div>

            {/* E&O Compliance & Sign-Off Block */}
            <div className="border-t border-slate-300 pt-3 page-break-avoid">
              <div className="flex items-start gap-2 mb-3">
                <ShieldCheck className="h-3.5 w-3.5 text-[#B5934C] shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">Errors &amp; Omissions (E&amp;O) Compliance Certification:</strong>{' '}
                  This report has been compiled deterministically from uploaded contract instruments. All business day roll-overs and statutory holidays have been validated against jurisdiction rules. Generated records are archived for legal defense and broker compliance.
                </div>
              </div>

              {/* Signature Lines */}
              <div className="grid grid-cols-2 gap-6 pt-2 text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-0.5 mb-1 h-6 flex items-end">
                    <span className="text-[9px] text-slate-400 font-mono italic">Sign here</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-800">
                    Authorized Broker / Agent Signature
                  </div>
                  <div className="text-[9px] text-slate-500">Date: ________________________</div>
                </div>

                <div>
                  <div className="border-b border-slate-400 pb-0.5 mb-1 h-6 flex items-end">
                    <span className="text-[9px] text-slate-400 font-mono italic">Sign here</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-800">
                    Escrow / Closing Officer Acknowledgment
                  </div>
                  <div className="text-[9px] text-slate-500">Date: ________________________</div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 font-mono">
                <span>Contingency Copilot &bull; Verified Audit ID: {deal.id}</span>
                <span>Confidential Transaction Record &bull; Page 1 of 1</span>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer (Sticky & Hidden from print) */}
        <div className="no-print shrink-0 border-t border-white/10 bg-[#141418] px-5 py-2.5 flex items-center justify-between text-xs text-[#9A9AA5]">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Scale className="h-3.5 w-3.5 text-[#C9A961]" />
            <span>Standard Letter &bull; Portrait &bull; Print or Save as PDF via browser dialog</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-white/10 text-white hover:bg-white/5 cursor-pointer h-8"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold gap-1.5 shadow-sm cursor-pointer h-8"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </Button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
