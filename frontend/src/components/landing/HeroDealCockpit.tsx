import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Building,
  Check,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ContingencyItem {
  id: string;
  name: string;
  formType: string;
  deadlineDisplay: string;
  countdown: string;
  statutoryRule: string;
  cutoffTime: string;
  status: 'critical' | 'upcoming' | 'cleared';
  quote: string;
  citation: string;
  recipients: string[];
}

const CONTINGENCIES: ContingencyItem[] = [
  {
    id: 'inspection',
    name: 'Physical Property Inspection',
    formType: 'CAR RPA Paragraph 14B & Form CR',
    deadlineDisplay: 'Friday, Nov 06 at 11:59 PM PST',
    countdown: '2 Days, 07 Hours Remaining',
    statutoryRule: 'Active Contingency Removal (Form CR) required by buyer',
    cutoffTime: '11:59 PM PST (Statutory California Standard)',
    status: 'critical',
    quote:
      'Buyer shall have 17 (or __) Days After Acceptance to complete all Buyer Investigations, and deliver to Seller a signed Contingency Removal (C.A.R. Form CR) or notice of cancellation...',
    citation: 'CAR RPA-CA, Page 4, Paragraph 14B(1)',
    recipients: ['Sarah Jenkins (Buyer Agent)', 'First American Title Escrow #88219', 'Lender Loan Officer'],
  },
  {
    id: 'financing',
    name: 'Loan & Appraisal Commitment',
    formType: 'CAR RPA Paragraph 8B',
    deadlineDisplay: 'Wednesday, Nov 11 at 11:59 PM PST',
    countdown: '7 Days, 11 Hours Remaining',
    statutoryRule: 'Bank holiday rollover: Veterans Day adjusted deterministically',
    cutoffTime: '11:59 PM PST (Rolled to next business day)',
    status: 'upcoming',
    quote:
      'Buyer shall deliver to Seller written notice of removal of the loan contingency within 21 Days After Acceptance. If Buyer fails to deliver such removal...',
    citation: 'CAR RPA-CA, Page 3, Paragraph 8B',
    recipients: ['Guaranteed Rate Mortgage', 'Escrow Officer', 'Managing Broker'],
  },
  {
    id: 'earnest',
    name: 'Earnest Money Deposit (EMD)',
    formType: 'CAR RPA Paragraph 3D(1)',
    deadlineDisplay: 'Completed & Stamped in Vault',
    countdown: 'Fully Cleared into Escrow',
    statutoryRule: '3 Business Days from Mutual Acceptance',
    cutoffTime: '5:00 PM PST Escrow Banking Hours',
    status: 'cleared',
    quote:
      'Buyer shall deliver to Escrow Holder an increased or initial deposit of $45,000 within 3 Business Days after Mutual Acceptance by wire transfer...',
    citation: 'CAR RPA-CA, Page 1, Paragraph 3D(1)',
    recipients: ['First American Title', 'Buyer Agent', 'Listing Broker'],
  },
];

export function HeroDealCockpit() {
  const [activeId, setActiveId] = useState<string>('inspection');
  const activeContingency = CONTINGENCIES.find((c) => c.id === activeId) || CONTINGENCIES[0];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_25px_60px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden text-left">
      {/* Top Cockpit Header */}
      <div className="p-5 sm:p-6 border-b border-[#E5E7EB] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center text-zinc-900 shadow-2xs">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0A0A0A] font-sans">
                1420 Ocean Avenue, Santa Monica, CA
              </h3>
              <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                ACTIVE ESCROW #84920
              </span>
            </div>
            <p className="text-xs text-[#52525B] font-sans">
              Purchase Price: $2,850,000 &bull; Earnest Money: $45,000 Secured
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E7EB] text-xs font-semibold text-zinc-800 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>E&amp;O Shield Active</span>
          </span>
        </div>
      </div>

      {/* Contingency Selector Tabs */}
      <div className="px-5 sm:px-6 pt-4 border-b border-[#E5E7EB] bg-white flex overflow-x-auto gap-2 scrollbar-none">
        {CONTINGENCIES.map((c) => {
          const isSelected = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`relative pb-3 px-3 text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-2 ${
                isSelected ? 'text-[#0A0A0A]' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>{c.name}</span>
              {c.status === 'critical' && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {c.status === 'cleared' && (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {isSelected && (
                <motion.div
                  layoutId="activeCockpitTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A0A0A]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Contingency Detail Panel */}
      <div className="p-6 sm:p-8 space-y-6 bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeContingency.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Countdown & Statutory Banner */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-7 p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-medium tracking-wider block">
                  Statutory Countdown &amp; Rule
                </span>
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-[#0A0A0A] font-mono">
                  <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{activeContingency.countdown}</span>
                </div>
                <p className="text-xs text-[#52525B]">
                  Deadline: <strong className="text-zinc-900">{activeContingency.deadlineDisplay}</strong> ({activeContingency.statutoryRule})
                </p>
              </div>

              <div className="md:col-span-5 p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-medium tracking-wider block">
                  Verbatim Contract Anchor
                </span>
                <span className="text-xs font-bold text-emerald-800 font-mono block">
                  {activeContingency.citation}
                </span>
                <span className="text-[11px] text-zinc-500 block">
                  Form: {activeContingency.formType}
                </span>
              </div>
            </div>

            {/* Verbatim Signed Clause Quote */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-[#E5E7EB] space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] uppercase font-semibold">
                <span>Original Executed Contract Language</span>
                <span className="text-emerald-700">Coordinates Verified &bull; Zero Hallucination</span>
              </div>
              <p className="italic text-zinc-800 font-serif leading-relaxed text-sm bg-white p-3 rounded-xl border border-zinc-200/80">
                &ldquo;{activeContingency.quote}&rdquo;
              </p>
            </div>

            {/* Automated Milestone Alerts Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase block font-medium">Daily Cutoff Rule</span>
                <strong className="text-zinc-900 block mt-0.5">{activeContingency.cutoffTime}</strong>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase block font-medium">Automated Notice Dispatch</span>
                <strong className="text-emerald-700 block mt-0.5">T-3, T-1 &amp; 9:00 AM Queued</strong>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase block font-medium">E&amp;O Audit Integrity</span>
                <strong className="text-zinc-900 block mt-0.5">Cryptographic SHA-256 Hash</strong>
              </div>
            </div>

            {/* Bottom Cockpit Action Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-zinc-100">
              <div className="flex items-center gap-2 text-zinc-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Synchronized with First American Title &bull; Escrow Officer Alerted</span>
              </div>

              <Link
                to="/deals"
                className="font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Inspect in Brokerage Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

