import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Deal, NotificationSetting } from '@/types';
import { formatDate } from '@/utils/date';
import {
  Building2,
  ChevronRight,
  ShieldCheck,
  Sparkles,
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
        {/* Command Center Frosted Glass Card */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl bg-[#141418] border border-white/[0.08]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 shrink-0">
                <Building2 className="h-5 w-5 text-[#C9A961]" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    {deal.propertyAddress}
                  </h1>

                  <Badge variant="gold" className="text-[10px]">
                    <ShieldCheck className="h-3 w-3 mr-1 text-[#C9A961]" />
                    <span>{deal.status}</span>
                  </Badge>

                  {alertsActive ? (
                    <Badge variant="neutral" className="bg-[#181820] border-white/[0.08] text-[#C9A961] text-[10px]">
                      <Mail className="h-3 w-3 mr-1 text-[#C9A961]" />
                      <span>Resend Alerts Armed ({notifSettings?.recipients?.length})</span>
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="bg-[#181820] border-white/[0.08] text-[#9A9AA5] text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1 text-amber-400" />
                      <span>Alerts Standby</span>
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-4 text-xs text-[#9A9AA5]">
                  {deal.acceptanceDate && (
                    <span>
                      Acceptance: <strong className="font-mono text-[#F5F5F7] font-normal">{formatDate(deal.acceptanceDate)}</strong>
                    </span>
                  )}
                  {deal.buyerName && (
                    <span>
                      Buyer: <strong className="text-[#F5F5F7] font-medium">{deal.buyerName}</strong>
                    </span>
                  )}
                  {deal.sellerName && (
                    <span>
                      Seller: <strong className="text-[#F5F5F7] font-medium">{deal.sellerName}</strong>
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
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C9A961]/15 via-[#C9A961]/10 to-transparent hover:from-[#C9A961]/25 hover:via-[#C9A961]/20 hover:to-[#C9A961]/10 text-[#F5F5F7] hover:text-white text-xs font-semibold flex items-center gap-2 border border-[#C9A961]/35 hover:border-[#C9A961]/60 shadow-[0_2px_12px_rgba(201,169,97,0.12)] transition-all cursor-pointer"
                title="Preview and export official transaction & contingency PDF report"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#C9A961]" />
                <span>Export PDF Report</span>
              </button>
            </div>
          </div>

          {/* Unified Sub-Navigation Sticky Tab Bar */}
          <div className="mt-4 -mb-1 flex items-center gap-1.5 overflow-x-auto border-t border-white/10 pt-3 no-scrollbar text-xs font-medium">
            <Link
              to={`/deals/${deal.id}`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all cursor-pointer ${
                currentTab === 'milestones'
                  ? 'bg-gradient-to-r from-[#C9A961]/20 via-[#C9A961]/15 to-[#C9A961]/10 text-white font-bold border border-[#C9A961]/50 shadow-[0_0_15px_rgba(201,169,97,0.18)]'
                  : 'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7]'
              }`}
            >
              <Calendar className={`h-3.5 w-3.5 ${currentTab === 'milestones' ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
              <span>Milestones</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/assistant`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all cursor-pointer ${
                currentTab === 'assistant'
                  ? 'bg-gradient-to-r from-[#C9A961]/20 via-[#C9A961]/15 to-[#C9A961]/10 text-white font-bold border border-[#C9A961]/50 shadow-[0_0_15px_rgba(201,169,97,0.18)]'
                  : 'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7]'
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${currentTab === 'assistant' ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
              <span>AI Copilot</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/notifications`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all cursor-pointer ${
                currentTab === 'notifications'
                  ? 'bg-gradient-to-r from-[#C9A961]/20 via-[#C9A961]/15 to-[#C9A961]/10 text-white font-bold border border-[#C9A961]/50 shadow-[0_0_15px_rgba(201,169,97,0.18)]'
                  : 'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7]'
              }`}
            >
              <Mail className={`h-3.5 w-3.5 ${currentTab === 'notifications' ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
              <span>Email &amp; Alerts</span>
            </Link>

            <Link
              to={`/deals/${deal.id}/review`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all cursor-pointer ${
                currentTab === 'documents'
                  ? 'bg-gradient-to-r from-[#C9A961]/20 via-[#C9A961]/15 to-[#C9A961]/10 text-white font-bold border border-[#C9A961]/50 shadow-[0_0_15px_rgba(201,169,97,0.18)]'
                  : 'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7]'
              }`}
            >
              <FileCheck className={`h-3.5 w-3.5 ${currentTab === 'documents' ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
              <span>Clause Verification</span>
            </Link>

            <Link
              to={`/audit?dealId=${deal.id}`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all cursor-pointer ${
                currentTab === 'audit'
                  ? 'bg-gradient-to-r from-[#C9A961]/20 via-[#C9A961]/15 to-[#C9A961]/10 text-white font-bold border border-[#C9A961]/50 shadow-[0_0_15px_rgba(201,169,97,0.18)]'
                  : 'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7]'
              }`}
            >
              <History className={`h-3.5 w-3.5 ${currentTab === 'audit' ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
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
