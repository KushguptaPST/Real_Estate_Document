import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Mail,
  AlertTriangle,
  Scale,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  FileText,
  ShieldCheck,
  Check,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicHeader } from '@/components/landing/PublicHeader';

export function DocsPage() {
  const [activeTab, setActiveTab] = useState<'lifecycle' | 'voice' | 'math' | 'alerts' | 'dos'>('lifecycle');

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A] pb-28 selection:bg-emerald-100 selection:text-emerald-900">
      <PublicHeader />
      <div className="pt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#047857] font-mono">
              Brokerage Knowledge Base
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
              Statutory SOP &bull; 50-State Rules
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Documentation &amp; Compliance Guidelines
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-2xl leading-relaxed">
            Standard operating procedures for managing AI speed-to-lead qualification, deterministic contingency timelines, and automated alert escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button asChild size="sm" className="rounded-full bg-[#0A0A0A] text-white hover:bg-[#1F2937] font-medium gap-1.5 h-9 text-xs px-4 shadow-xs">
            <Link to="/upload">
              <FileText className="h-3.5 w-3.5" />
              <span>Ingest Contract PDF</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Tab Selector ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'lifecycle', label: '1. Transaction Lifecycle', icon: Calendar },
          { id: 'voice', label: '2. AI Voice & Inbound SOP', icon: PhoneCall },
          { id: 'math', label: '3. Calculation Rules & Math', icon: Clock },
          { id: 'alerts', label: '4. Resend Alert Windows', icon: Mail },
          { id: 'dos', label: '5. Legal DOs & DON’Ts', icon: Scale },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#F8F9FA]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content Container ── */}
      <div className="bg-white p-7 sm:p-9 rounded-3xl border border-[#E5E7EB] shadow-xs space-y-6">
        
        {/* TAB 1: 4-Stage Lifecycle */}
        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#047857]" />
                <span>4-Stage Autonomous Escrow Lifecycle</span>
              </h2>
              <span className="text-xs text-[#6B7280]">Standard Operating Procedure</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <span className="text-[10px] font-bold text-[#0A0A0A] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">Stage 1</span>
                <h3 className="font-bold text-sm text-[#0A0A0A]">Contract Ingestion &amp; OCR Indexing</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Upload signed Purchase Agreement (NWMLS Form 21, CAR RPA, TREC 1-4, FAR/BAR). Vector embeddings and deterministic regex index clauses in under 2.4s.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <span className="text-[10px] font-bold text-[#047857] uppercase tracking-wider bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">Stage 2</span>
                <h3 className="font-bold text-sm text-[#0A0A0A]">Verifiable Line Citation Review</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Agent reviews extracted dates against PDF line coordinates (§4.2, Pg 4, Line 18). Any manual adjustment is recorded with cryptographic user attribution.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <span className="text-[10px] font-bold text-[#047857] uppercase tracking-wider bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">Stage 3</span>
                <h3 className="font-bold text-sm text-[#0A0A0A]">Deterministic Countdown &amp; Outbox Alerts</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Transactional outbox monitors cutoff windows (e.g. 9:00 PM PST) and automatically sends escalation notices to buyer, seller, and escrow officer at T-3, T-1, and 9:00 AM day-of.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <span className="text-[10px] font-bold text-[#0A0A0A] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">Stage 4</span>
                <h3 className="font-bold text-sm text-[#0A0A0A]">Contingency Removal &amp; Audit Seal</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Formal removal addenda (CAR Form CR, NWMLS Form 35R) are confirmed. Deal converts to firm escrow; tamper-evident SHA-256 E&amp;O audit log is archived.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI Voice & Inbound SOP */}
        {activeTab === 'voice' && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-[#047857]" />
                <span>AI Inbound Sales Copilot &amp; Tour Booking SOP</span>
              </h2>
              <span className="text-xs text-[#6B7280]">Speed-to-Lead Protocol</span>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <h3 className="font-bold text-sm text-[#0A0A0A]">Sub-60s Inbound Voice Calling</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  When a buyer submits an inquiry via Zillow, Realtor.com, or brokerage landing page, Plivo high-throughput telephony triggers an immediate duplex call. Deepgram Nova-2 STT and Cartesia TTS ensure sub-450ms voice latency that feels natural and conversational.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <h3 className="font-bold text-sm text-[#0A0A0A]">WhatsApp Audio Note &amp; Showing Scheduler</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  If the buyer prefers text or does not pick up, an automated WhatsApp audio voice memo is dispatched with interactive time slots. GraphRAG memory recalls buyer price point, school district preferences, and pre-approval status.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-2">
                <h3 className="font-bold text-sm text-[#0A0A0A]">3-Tier Human Takeover Protocol</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Licensed agents receive live push notifications when a buyer expresses urgent offer intent. Clicking "Take Over Call" bridges the human agent onto the audio stream seamlessly while the AI gracefully hands off.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Date Math Rules */}
        {activeTab === 'math' && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#047857]" />
                <span>Deterministic Date Calculation Rules</span>
              </h2>
              <span className="text-xs text-[#6B7280]">Zero LLM Hallucinations</span>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <h3 className="font-bold text-sm text-[#0A0A0A]">Day 0 Rule (Mutual Acceptance)</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  The date of Mutual Acceptance is always Day 0. Calculation strictly begins on Day 1 (the calendar day immediately following acceptance).
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <h3 className="font-bold text-sm text-[#0A0A0A]">State Statutory Cutoff Hours</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  Washington NWMLS cutoff is <strong>9:00 PM PST</strong>. California CAR cutoff is <strong>11:59 PM PST</strong>. Texas TREC and Florida FAR/BAR default to <strong>5:00 PM local time</strong>. The engine automatically enforces the governing state jurisdiction.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <h3 className="font-bold text-sm text-[#0A0A0A]">Holiday &amp; Weekend Roll-Forward Logic</h3>
                <p className="text-[#6B7280] leading-relaxed">
                  If the final day of a contingency lands on a Saturday, Sunday, or official Federal/State court holiday, the expiration automatically rolls forward to 5:00 PM (or state cutoff) on the next business day.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Alert Schedules */}
        {activeTab === 'alerts' && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#047857]" />
                <span>Transactional Outbox Escalation Windows</span>
              </h2>
              <span className="text-xs text-[#6B7280]">Resend High-Deliverability Engine</span>
            </div>

            <div className="space-y-3">
              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">T-3 Days</span>
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Early Runway Warning Notice</h3>
                </div>
                <p className="text-[#6B7280] leading-relaxed">
                  Dispatched 72 hours prior to deadline cutoff. Allows buyer's agent to confirm inspector availability or verify loan underwriting status with the lender.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">T-1 Day (24h)</span>
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Urgent Action Escalation Notice</h3>
                </div>
                <p className="text-[#6B7280] leading-relaxed">
                  Dispatched 24 hours prior to deadline. Highlights exact contractual citation (§4.2) and prompts agent to either deliver signed removal or submit formal extension addendum.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">T-0 Day Of</span>
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Final Expiration Morning Alert</h3>
                </div>
                <p className="text-[#6B7280] leading-relaxed">
                  Dispatched at 9:00 AM local property time. Escalates to Managing Broker and Transaction Coordinator if removal notice is still unconfirmed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DOs and DON'Ts */}
        {activeTab === 'dos' && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#047857]" />
                <span>Brokerage Risk &amp; E&amp;O Defense DOs &amp; DON’Ts</span>
              </h2>
              <span className="text-xs text-[#6B7280]">Legal Best Practices</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-6 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/50 space-y-3">
                <h3 className="font-bold text-sm text-[#065F46] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#047857]" />
                  <span>DOs for Licensed Agents &amp; TCs</span>
                </h3>
                <ul className="space-y-2 text-[#065F46] list-disc pl-4 leading-relaxed">
                  <li><strong>DO</strong> verify the executed Mutual Acceptance Date on the final signature page before locking the timeline.</li>
                  <li><strong>DO</strong> deliver written contingency removal notices before the governing state cutoff time (9:00 PM NWMLS, 11:59 PM CAR).</li>
                  <li><strong>DO</strong> obtain written, mutually-signed extension addenda before a contingency expires.</li>
                  <li><strong>DO</strong> download and archive the SHA-256 E&amp;O audit trail into your brokerage transaction vault.</li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2]/60 space-y-3">
                <h3 className="font-bold text-sm text-[#991B1B] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                  <span>DON’Ts to Prevent Deposit Forfeiture</span>
                </h3>
                <ul className="space-y-2 text-[#991B1B] list-disc pl-4 leading-relaxed">
                  <li><strong>DON'T</strong> rely on verbal agreements, voice calls, or text messages for contingency extensions.</li>
                  <li><strong>DON'T</strong> assume an automatic extension exists without fully executed bilateral addenda.</li>
                  <li><strong>DON'T</strong> use generic AI chatbots (ChatGPT/Claude) to compute dates without statutory holiday calendar checks.</li>
                  <li><strong>DON'T</strong> allow earnest money deposits to go unverified past the 2-day or 3-day statutory delivery window.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}
