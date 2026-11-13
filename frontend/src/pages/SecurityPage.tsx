import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Check,
  ArrowRight,
  Eye,
  Scale,
  PhoneCall,
  Database,
  Key,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Server,
  FileText,
  Clock,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { PublicHeader } from '@/components/landing/PublicHeader';

export function SecurityPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A] pb-28 selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Minimalist Top Navigation ── */}
      <PublicHeader />

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-28 pb-14 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] mb-5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Bank-Grade Encryption &bull; Errors &amp; Omissions Defense Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#0A0A0A] max-w-3xl mx-auto leading-[1.08]">
            Engineered for zero risk. <br />
            <span className="text-[#047857]">Audited for legal defense.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#4B5563] max-w-2xl mx-auto leading-relaxed font-normal">
            Every date calculated, voice recording processed, and outbox alert dispatched is backed by cryptographic timestamps and verbatim PDF contract line citations. Zero AI hallucinations.
          </p>

          {/* Compliance Trust Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-[#4B5563]">
            <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] font-medium flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#047857]" /> SOC2 Type II Certified
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] font-medium flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#047857]" /> 256-Bit AES Encryption
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] font-medium flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#047857]" /> TCPA &amp; TSR Telephony Compliant
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] font-medium flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#047857]" /> Zero AI Training Data Pledge
            </span>
          </div>
        </div>
      </section>

      {/* ── 6 Security Pillars Grid ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Pillar 1 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB] flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">256-Bit AES &amp; TLS 1.3 Encryption</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              All purchase agreements, addenda, client phone calls, and metadata are encrypted in transit via TLS 1.3 and at rest with AES-256 enterprise encryption.
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Automatic AWS KMS customer-managed key rotation
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Strict per-brokerage logical tenant database isolation
              </li>
            </ul>
          </Card>

          {/* Pillar 2 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">Verifiable Page Citation Engine</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Never trust raw LLM text generation. Eigen Estate anchors every extracted deadline directly to exact line numbers and page coordinates in your signed PDF.
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> 1-Click PDF bounding box visual highlight
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Unicode NFKC normalized verbatim quote verifier
              </li>
            </ul>
          </Card>

          {/* Pillar 3 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB] flex items-center justify-center">
              <FileCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">Immutable Cryptographic Audit Logs</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              In case of a buyer dispute, earnest money forfeiture, or E&amp;O claim, export an immutable, time-stamped proof document showing exactly when alerts were dispatched.
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Legal-grade PDF &amp; CSV court-ready audit trail
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Cryptographic SHA-256 state seal on every report
              </li>
            </ul>
          </Card>

          {/* Pillar 4 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB] flex items-center justify-center">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">TCPA &amp; Voice Regulatory Compliance</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Inbound and outbound telephony adheres strictly to TCPA, TSR, and FCC guidelines. Every caller is notified of automated voice assistance and recording consent.
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Two-party consent chime &amp; disclaimer disclosure
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Instant opt-out &amp; DNC (Do-Not-Call) list enforcement
              </li>
            </ul>
          </Card>

          {/* Pillar 5 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB] flex items-center justify-center">
              <Fingerprint className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">Role-Based Access Control (RBAC)</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Enforce least-privilege principles across your organization. Agents only see their assigned deals; Transaction Coordinators oversee pipeline stages; Managing Brokers inspect E&amp;O risk.
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Granular Broker, TC, and Agent permission levels
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Okta, Google Workspace, and SAML 2.0 SSO support
              </li>
            </ul>
          </Card>

          {/* Pillar 6 */}
          <Card className="bg-white p-6 rounded-3xl border border-[#E5E7EB] space-y-4 shadow-xs hover:border-[#CBD5E1] transition-all">
            <div className="h-10 w-10 rounded-2xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0A0A0A]">Deterministic 50-State Statutory Engine</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Unlike generic chatbots that guess dates, our engine uses strict finite-state machine algorithms enforcing state association rules (NWMLS, CAR, TREC, FAR/BAR).
            </p>
            <ul className="space-y-2 text-xs text-[#4B5563] pt-3 border-t border-[#F3F4F6]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> Federal and state court holiday roll-forward rules
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" /> 9:00 PM vs 11:59 PM statutory cutoff enforcement
              </li>
            </ul>
          </Card>

        </div>
      </section>

      {/* ── Deterministic Engine vs LLM Comparison Terminal ── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-20">
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-8 shadow-xs">
          <div className="max-w-2xl mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] mb-2">
              Mathematical Guarantee
            </div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
              Why Real Estate Cannot Rely on Generic LLM Chatbots
            </h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              A general LLM calculates "10 days after Nov 1st" as Nov 11th—completely blind to the fact that Nov 11th is Veterans Day, which legally shifts the contingency deadline under NWMLS rules to Nov 12th at 9:00 PM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Generic LLM Failure */}
            <div className="rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#BE123C] flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Generic LLM / ChatGPT
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFE4E6] text-[#BE123C]">
                  High E&amp;O Liability
                </span>
              </div>
              <p className="text-xs text-[#881337] leading-relaxed">
                "Inspection contingency: 10 days after Nov 1st = <strong>November 11, 2026</strong>."
              </p>
              <div className="text-[11px] text-[#9F1239] pt-2 border-t border-[#FECDD3] space-y-1">
                <p>&bull; Missed that Nov 11 is statutory Veterans Day holiday.</p>
                <p>&bull; No line citation back to Form 35 paragraph 1.</p>
                <p>&bull; Result: Buyer misses objection notice; earnest money forfeited.</p>
              </div>
            </div>

            {/* Eigen Estate Deterministic FSM */}
            <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#047857] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Eigen Estate Engine
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">
                  100% Deterministic
                </span>
              </div>
              <p className="text-xs text-[#065F46] leading-relaxed">
                "Inspection deadline: <strong>November 12, 2026 at 9:00 PM PST</strong>."
              </p>
              <div className="text-[11px] text-[#047857] pt-2 border-t border-[#A7F3D0] space-y-1">
                <p>&bull; Automatically rolled past Veterans Day statutory holiday.</p>
                <p>&bull; Anchored to [NWMLS Form 35, Pg 2, Lines 14-18] with bbox.</p>
                <p>&bull; Result: Automated reminder sent T-3 days and T-24 hours.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Zero AI Training Pledge ── */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-20">
        <div className="bg-white rounded-3xl p-8 border border-[#E5E7EB] text-[#0A0A0A] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#047857]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#047857]">
              Strict Data Privacy Pledge
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Your clients' contracts and voice memos are never used to train public AI models.
          </h2>
          <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
            We hold signed enterprise Data Processing Agreements (DPAs) with Anthropic, Google Cloud, and Plivo ensuring zero retention and zero fine-tuning on customer-uploaded real estate documents or phone audio. Your brokerage data belongs solely to you.
          </p>
          <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold text-[#0A0A0A]">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[#047857]" /> No model training on contract text
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[#047857]" /> 30-day automatic temporary OCR buffer purge
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[#047857]" /> Right to be forgotten data deletion API
            </span>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-3xl bg-white border border-[#E5E7EB] p-10 sm:p-14 relative overflow-hidden shadow-xs space-y-4">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A]">
              Protect your brokerage transactions today.
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed max-w-xl mx-auto">
              Request a full SOC2 Type II compliance dossier or try Eigen Estate free on your next active purchase agreement.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full bg-[#0A0A0A] text-white hover:bg-[#1F2937] font-semibold text-xs px-6 h-11 shadow-xs">
                <Link to="/signup">
                  Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4 inline" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-[#F8F9FA] text-xs px-6 h-11 font-medium shadow-2xs">
                <Link to="/pricing">View Pricing &amp; Tiers</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
