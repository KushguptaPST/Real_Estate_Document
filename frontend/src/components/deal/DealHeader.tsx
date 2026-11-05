import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Deal, NotificationSetting } from '@/types';
import { formatDate } from '@/utils/date';
import {
  Building2,
  ChevronRight,
  ShieldCheck,
  FileText,
  MessageSquare,
  Mail,
  FileCheck,
  History,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { DealReportModal } from './DealReportModal';
import { Badge } from '../ui/badge';

interface Props {
  deal: Deal | null;
  notifSettings?: NotificationSetting | null;
  activeTab?: 'milestones' | 'assistant' | 'notifications' | 'documents' | 'audit';
}

export function DealHeader({ deal, notifSettings, activeTab }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const location = useLocation();

  if (!deal) return null;

  const currentTab =
    activeTab ??
    (location.pathname.endsWith('/assistant')
      ? 'assistant'
      : location.pathname.endsWith('/notifications')
      ? 'notifications'
      : location.pathname.endsWith('/review')
      ? 'documents'
      : 'milestones');

  const alertsActive = notifSettings?.enabled && (notifSettings.recipients?.length ?? 0) > 0;

  return (
    <>
      <div className="space-y-3">
        {/* Command Center Card */}
        <div className="rounded-2xl p-5 bg-white border border-zinc-200/90 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 shrink-0">
                <Building2 className="h-5 w-5 text-zinc-900" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-zinc-950 tracking-tight">
                    {deal.propertyAddress}
                  </h1>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    <span>{deal.status === 'ACTIVE' ? 'In Escrow' : deal.status}</span>
                  </span>

                  {alertsActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 px-2.5 py-0.5 text-[10px] font-medium">
                      <Mail className="h-3 w-3 text-zinc-600" />
                      <span>Alerts Active ({notifSettings?.recipients?.length})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-0.5 text-[10px] font-medium">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <span>Alerts Standby</span>
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-500">
                  {deal.acceptanceDate && (
                    <span>
                      Acceptance: <strong className="font-mono text-zinc-800 font-semibold">{formatDate(deal.acceptanceDate)}</strong>
                    </span>
                  )}
                  {deal.buyerName && (
                    <span>
                      Buyer: <strong className="text-zinc-800 font-semibold">{deal.buyerName}</strong>
                    </span>
                  )}
                  {deal.sellerName && (
                    <span>
                      Seller: <strong className="text-zinc-800 font-semibold">{deal.sellerName}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center gap-2 border border-zinc-200 shadow-2xs transition-all cursor-pointer"
                title="Preview and export official transaction & contingency PDF report"
              >
                <FileText className="h-3.5 w-3.5 text-zinc-600" />
                <span>Export PDF Report</span>
              </button>
            </div>
          </div>

          {/* Unified Sub-Navigation Sticky Tab Bar */}
          <div className="mt-4 -mb-1 flex items-center gap-1.5 overflow-x-auto border-t border-zinc-100 pt-3 no-scrollbar text-xs font-medium">
            <Link
              to={`/deals/${deal.id}`}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                currentTab === 'milestones'
                  ? 'bg-[#0A0A0A] text-white font-semibold shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Milestones</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/assistant`}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                currentTab === 'assistant'
                  ? 'bg-[#0A0A0A] text-white font-semibold shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copilot</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/notifications`}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                currentTab === 'notifications'
                  ? 'bg-[#0A0A0A] text-white font-semibold shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Alerts</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/review`}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                currentTab === 'documents'
                  ? 'bg-[#0A0A0A] text-white font-semibold shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span>Clauses</span>
            </Link>

            <Link
              to={`/audit?dealId=${deal.id}`}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                currentTab === 'audit'
                  ? 'bg-[#0A0A0A] text-white font-semibold shadow-2xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit History</span>
            </Link>
          </div>
        </div>
      </div>

      <DealReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        deal={deal}
        notifSettings={notifSettings}
      />
    </>
  );
}
