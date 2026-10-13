import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Check,
  ArrowRight,
  Eye,
  Scale,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] pb-24">
      {/* Hero */}
      <section className="pt-12 pb-14 text-center border-b border-white/[0.08] bg-[#0D0D11]/60 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Badge variant="neutral" className="mb-4 bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/20 px-3.5 py-1 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C9A961] mr-1.5 inline" /> Bank-Grade Security &amp; Legal Auditability
          </Badge>
          <h1 className="text-4xl font-semibold text-[#F5F5F7] tracking-tight sm:text-5xl">
            Built for Errors &amp; Omissions (E&amp;O) Defense
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#9A9AA5] max-w-2xl mx-auto leading-relaxed">
            Every date calculated, email notification sent, and user edit is backed by cryptographic timestamps and verifiable contract PDF page citations. Zero AI hallucinations.
          </p>
        </div>
      </section>

      {/* Security Pillars Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <Card className="bg-[#141418] p-6.5 rounded-2xl border border-white/[0.08] space-y-4 shadow-xl hover:border-[#C9A961]/30 transition-all">
            <div className="p-3 w-fit rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-[#F5F5F7]">256-Bit AES Encryption</h3>
            <p className="text-xs text-[#9A9AA5] leading-relaxed">
              All purchase agreements, addenda, and client metadata are encrypted in transit via TLS 1.3 and at rest with AES-256 enterprise encryption.
            </p>
            <ul className="space-y-2 text-xs text-[#9A9AA5] pt-3 border-t border-white/[0.06]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> SOC2 Type II Certified Infrastructure
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> Automatic key rotation &amp; isolated tenant silos
              </li>
            </ul>
          </Card>

          <Card className="bg-[#141418] p-6.5 rounded-2xl border border-white/[0.08] space-y-4 shadow-xl hover:border-[#C9A961]/30 transition-all">
            <div className="p-3 w-fit rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-[#F5F5F7]">Verifiable Page Citation Engine</h3>
            <p className="text-xs text-[#9A9AA5] leading-relaxed">
              Never trust raw LLM text generation. Contingency Copilot anchors every extracted date directly to exact line numbers and page coordinates in your original PDF.
            </p>
            <ul className="space-y-2 text-xs text-[#9A9AA5] pt-3 border-t border-white/[0.06]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> 1-Click PDF Bounding Box Highlight
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> Zero hallucination quote verifier check
              </li>
            </ul>
          </Card>

          <Card className="bg-[#141418] p-6.5 rounded-2xl border border-white/[0.08] space-y-4 shadow-xl hover:border-[#C9A961]/30 transition-all">
            <div className="p-3 w-fit rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <FileCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-[#F5F5F7]">Immutable Audit Logs</h3>
            <p className="text-xs text-[#9A9AA5] leading-relaxed">
              In case of a legal dispute or E&amp;O claim, export an immutable, time-stamped proof document showing exactly when alerts were sent and when dates were verified.
            </p>
            <ul className="space-y-2 text-xs text-[#9A9AA5] pt-3 border-t border-white/[0.06]">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> Legal-Grade PDF &amp; CSV Audit Trail
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#34D399]" /> Resend delivery receipt headers included
              </li>
            </ul>
          </Card>

        </div>
      </section>

      {/* Zero AI Training Pledge */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 mt-16">
        <div className="bg-[#141418] rounded-2xl p-8 border border-white/[0.08] text-[#F5F5F7] shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-[#34D399]/15 text-[#34D399] border-[#34D399]/25 font-semibold px-3 py-1">
              Strict Data Privacy Pledge
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold text-[#F5F5F7]">Your Client Real Estate Contracts Are Never Used for Model Training</h2>
          <p className="text-xs text-[#9A9AA5] leading-relaxed">
            We operate strict zero-retention policies with our LLM inference providers. Your client contracts, earnest money terms, and buyer/seller identities are processed strictly in RAM for extraction and immediately discarded from memory.
          </p>
          <div className="pt-4 flex items-center justify-between flex-wrap gap-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-[#9A9AA5]">
              <Eye className="h-4 w-4 text-[#34D399]" /> Confidential Agent &amp; Client Data Safeguard
            </div>
            <Button asChild className="rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold text-xs px-5 py-2">
              <Link to="/upload">Explore Workspace <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
