import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Mail,
  Sparkles,
  AlertTriangle,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function DocsPage() {
  const [activeTab, setActiveTab] = useState<'lifecycle' | 'math' | 'alerts' | 'dos'>('lifecycle');

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C9A961] font-mono">
              Brokerage Knowledge Base
            </span>
            <Badge variant="neutral" className="bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/20 font-mono text-[10px]">
              Agent Playbook &amp; Rules
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7] sm:text-3xl">
            Documentation &amp; Compliance Guidelines
          </h1>
          <p className="text-xs text-[#9A9AA5] mt-1 max-w-2xl">
            Standard operating procedures for managing contingency timelines, contract math rules, and automated dispatches.
          </p>
        </div>

        <Button asChild size="sm" className="rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold gap-1.5 h-9 text-xs shadow-sm">
          <Link to="/upload">
            <Sparkles className="h-4 w-4" />
            <span>Ingest Contract PDF</span>
          </Link>
        </Button>
      </div>

      {/* ── Tab Selector ── */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { id: 'lifecycle', label: '1. Transaction Lifecycle', icon: Calendar },
          { id: 'math', label: '2. Calculation Rules & Math', icon: Clock },
          { id: 'alerts', label: '3. Resend Alert Windows', icon: Mail },
          { id: 'dos', label: '4. Legal DOs & DON’Ts', icon: Scale },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#C9A961] text-[#0A0A0B] shadow-sm'
                  : 'bg-[#141418] border border-white/[0.08] text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-white/20'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-[#141418] p-8 rounded-2xl border border-white/[0.08] shadow-xl space-y-6">
        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#C9A961]" />
              <span>4-Stage Contingency Lifecycle</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1.5 hover:border-[#C9A961]/30 transition-all">
                <span className="text-[10px] font-semibold text-[#C9A961] uppercase tracking-wider">Stage 1</span>
                <h3 className="font-semibold text-[#F5F5F7]">Contract Ingestion</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Upload Executed Purchase &amp; Sale Agreement PDF. AI vector embeddings index the contract text layers.
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1.5 hover:border-[#C9A961]/30 transition-all">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stage 2</span>
                <h3 className="font-semibold text-[#F5F5F7]">Verification &amp; Confirmation</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Agent reviews extracted clauses against PDF quotes, adjusts dates if needed, and clicks "Confirm All".
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1.5 hover:border-[#C9A961]/30 transition-all">
                <span className="text-[10px] font-semibold text-[#34D399] uppercase tracking-wider">Stage 3</span>
                <h3 className="font-semibold text-[#F5F5F7]">Automated Alert Surveillance</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Resend engine triggers automated reminder notices to agents and TCs at T-3, T-1, and day-of cutoff.
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1.5 hover:border-[#C9A961]/30 transition-all">
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Stage 4</span>
                <h3 className="font-semibold text-[#F5F5F7]">Waiver &amp; Execution Locking</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Written contingency notices or waivers are signed and recorded in the tamper-evident audit history.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'math' && (
          <div className="space-y-6 text-xs">
            <h2 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C9A961]" />
              <span>Deterministic Date Calculation Rules</span>
            </h2>

            <div className="space-y-3">
              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <h3 className="font-semibold text-[#F5F5F7]">Day 0 Rule</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  The date of Mutual Acceptance is Day 0. Calculation begins on Day 1 (the calendar day following acceptance).
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <h3 className="font-semibold text-[#F5F5F7]">Calendar Days vs. Business Days</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Unless the contract explicitly states "Business Days", all timeline windows default to consecutive calendar days. If a deadline lands on a weekend or federal holiday, cutoff shifts to 5:00 PM on the next business day.
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <h3 className="font-semibold text-[#F5F5F7]">5:00 PM Local Time Cutoff</h3>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Notice cutoffs default to 5:00 PM local property timezone unless otherwise specified in special stipulations.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6 text-xs">
            <h2 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#C9A961]" />
              <span>Resend Automated Alert Schedule</span>
            </h2>

            <div className="space-y-3">
              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="neutral" className="font-mono text-[10px] bg-[#C9A961]/15 text-[#C9A961] border-[#C9A961]/25">T-3 Days</Badge>
                  <h3 className="font-semibold text-[#F5F5F7]">Early Warning Notice</h3>
                </div>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Dispatched 3 calendar days prior to expiration. Gives buyer and agent runway to schedule inspections or title reviews.
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="warning" className="font-mono text-[10px] bg-amber-500/15 text-amber-300 border-amber-500/25">T-1 Day</Badge>
                  <h3 className="font-semibold text-[#F5F5F7]">High-Priority Action Required</h3>
                </div>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Dispatched 24 hours prior to deadline cutoff. Reminds agent to draft objection notice or request formal extension.
                </p>
              </div>

              <div className="p-4.5 rounded-xl bg-[#0D0D11] border border-white/[0.08] space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="destructive" className="font-mono text-[10px] bg-rose-500/15 text-rose-300 border-rose-500/25">T-0 Day Of</Badge>
                  <h3 className="font-semibold text-[#F5F5F7]">Execution Notice</h3>
                </div>
                <p className="text-[#9A9AA5] leading-relaxed">
                  Dispatched at 9:00 AM local time on the expiration date. Final alert before 5:00 PM waiver cutoff.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dos' && (
          <div className="space-y-6 text-xs">
            <h2 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Scale className="h-5 w-5 text-[#C9A961]" />
              <span>Legal DOs &amp; DON’Ts Cheat Sheet</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-[#34D399]/25 bg-[#34D399]/10 space-y-2">
                <h3 className="font-semibold text-[#34D399] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                  <span>DOs</span>
                </h3>
                <ul className="space-y-1.5 text-[#F5F5F7] list-disc pl-4 leading-relaxed">
                  <li>DO verify Mutual Acceptance Date on the binding contract signature page.</li>
                  <li>DO deliver written objection notices before 5:00 PM local cutoff time.</li>
                  <li>DO obtain written extension addenda signed by both parties before deadline lapses.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl border border-rose-500/25 bg-rose-500/10 space-y-2">
                <h3 className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span>DON’Ts</span>
                </h3>
                <ul className="space-y-1.5 text-[#F5F5F7] list-disc pl-4 leading-relaxed">
                  <li>DON’T rely on verbal communications or text messages for contingency waivers.</li>
                  <li>DON’T assume automatic extension without executed written mutual consent.</li>
                  <li>DON’T let earnest money deposits remain unmonitored without active email alerts.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
