import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealsApi } from '@/services/api';
import { UploadZone } from '@/components/UploadZone';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  Sparkles,
  Calendar,
  User,
  ShieldCheck,
  Zap,
  Check,
  Loader2,
  Info,
  Lock,
  Layers,
  MapPin,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'upload' | 'done'>('form');
  const [dealId, setDealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [propertyAddress, setPropertyAddress] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [acceptanceDate, setAcceptanceDate] = useState('');

  const fillSampleDeal = () => {
    setPropertyAddress('1420 Evergreen Vista Way, Bellevue, WA 98004');
    setBuyerName('Alexander & Elena Vance');
    setSellerName('Highland Properties Trust');
    const today = new Date().toISOString().split('T')[0];
    setAcceptanceDate(today);
  };

  async function handleDealCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!propertyAddress.trim()) {
      setError('Property address is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const deal = await dealsApi.create({
        propertyAddress: propertyAddress.trim(),
        buyerName: buyerName.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
        acceptanceDate: acceptanceDate || undefined,
      });
      setDealId(deal.id);
      setStep('upload');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { key: 'form', label: 'Deal Entities', desc: 'Property & Parties' },
    { key: 'upload', label: 'Contract Ingestion', desc: 'PDF Document & OCR' },
    { key: 'done', label: 'AI Extraction', desc: 'Deadlines & E&O Guard' },
  ] as const;
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-4 space-y-8">
      {/* Subtle Luxury Ambient Radial Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 bg-[radial-gradient(ellipse_at_top,rgba(201,169,97,0.12),transparent_70%)]" />

      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A961]/30 bg-[#C9A961]/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#C9A961]">
            <Sparkles className="h-3 w-3" />
            Transaction Intake
          </span>
          <Badge variant="neutral" className="text-[10px] border-white/10 bg-[#16161C] text-[#9A9AA5]">
            Step {stepIndex + 1} of 3
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6E6E7A] font-mono ml-auto">
            <Lock className="h-3 w-3 text-emerald-400" />
            256-Bit Encrypted Escrow Room
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-3xl">
          Ingest Purchase Agreement
        </h1>
        <p className="text-xs text-[#9A9AA5] max-w-2xl leading-relaxed">
          Enter transaction counterparties and upload your executed PDF contract. Contingency calendar deadlines, state-mandated statutory holidays, and citation embeddings will be generated deterministically.
        </p>
      </div>

      {/* Luxury Segmented Stepper Indicator */}
      <div className="rounded-2xl border border-white/10 bg-[#141418]/90 p-3 sm:p-4 shadow-xl backdrop-blur-md">
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 select-none">
          {steps.map((s, i) => {
            const isCompleted = i < stepIndex;
            const isCurrent = i === stepIndex;

            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-[#1E1E26] border border-[#C9A961]/40 shadow-[0_0_20px_rgba(201,169,97,0.1)]'
                    : isCompleted
                    ? 'bg-white/[0.02] border border-white/5'
                    : 'bg-transparent border border-transparent opacity-60'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-mono font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isCurrent
                      ? 'bg-[#C9A961] text-[#0A0A0B] shadow-[0_0_15px_rgba(201,169,97,0.4)]'
                      : 'bg-[#181820] text-[#6E6E7A] border border-white/10'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-[#F5F5F7]' : isCompleted ? 'text-[#D0D0D8]' : 'text-[#6E6E7A]'}`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-[#9A9AA5] truncate">
                    {s.desc}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Form */}
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-white/10 bg-gradient-to-b from-[#16161D] via-[#141418] to-[#101014] shadow-2xl backdrop-blur-xl">
              <CardHeader className="pb-5 border-b border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#C9A961]" />
                      Transaction Counterparties &amp; Terms
                    </CardTitle>
                    <CardDescription className="text-xs text-[#9A9AA5] mt-1">
                      Primary metadata used for calculating business-day calendars and drafting reminder notices.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={fillSampleDeal}
                    className="gap-1.5 text-[11px] h-8 px-3 border-[#C9A961]/30 bg-[#C9A961]/10 text-[#C9A961] hover:bg-[#C9A961]/20 hover:border-[#C9A961]/50 self-start sm:self-auto cursor-pointer transition-all"
                  >
                    <Zap className="h-3 w-3 text-[#C9A961]" />
                    <span>Auto-Fill Sample (WA Form 21)</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={(e) => void handleDealCreate(e)} className="space-y-5">
                  {/* Property Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#F5F5F7] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#C9A961]" />
                        Property Address <span className="text-rose-400">*</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#6E6E7A]">Full Legal / MLS Address</span>
                    </label>
                    <Input
                      required
                      placeholder="e.g. 1420 Evergreen Vista Way, Bellevue, WA 98004"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      className="h-10 text-xs"
                    />
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-[#6E6E7A]">Supported MLS / Board standards:</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-[#9A9AA5] border border-white/5">NWMLS</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-[#9A9AA5] border border-white/5">CAR California</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-[#9A9AA5] border border-white/5">TREC Texas</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-[#9A9AA5] border border-white/5">NY MLS</span>
                    </div>
                  </div>

                  {/* Buyer & Seller Counterparties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#C9A961]" />
                        Buyer Full Name / Purchasing Entity
                      </label>
                      <Input
                        placeholder="e.g. Alexander & Elena Vance"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#C9A961]" />
                        Seller Full Name / Entity / Trust
                      </label>
                      <Input
                        placeholder="e.g. Highland Properties Trust"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>

                  {/* Mutual Acceptance Date */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#F5F5F7] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#C9A961]" />
                        Contract Mutual Acceptance Date (Day 0)
                      </span>
                      <span className="text-[10px] font-mono text-[#C9A961]">Statutory Window Anchor</span>
                    </label>
                    <Input
                      type="date"
                      value={acceptanceDate}
                      onChange={(e) => setAcceptanceDate(e.target.value)}
                      className="h-10 text-xs font-mono"
                    />

                    {/* Explanatory E&O callout box */}
                    <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#101014] p-3 text-xs text-[#9A9AA5]">
                      <Info className="h-4 w-4 shrink-0 text-[#C9A961] mt-0.5" />
                      <div className="space-y-0.5 text-[11px] leading-relaxed">
                        <p>
                          The date mutual acceptance was finalized. Used as <span className="text-[#F5F5F7] font-semibold">Day 0</span> to calculate relative business/calendar day windows.
                        </p>
                        <p className="text-[#6E6E7A]">
                          Per standard practice (e.g. WA RCW 64.06), Day 1 begins on the next business day. All state legal holidays and 9:00 PM cutoff rules are deterministically applied.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* E&O Compliance Strip */}
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-300">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#C9A961]" />
                    <span className="text-[11px]">
                      <strong>Deterministic E&amp;O Protection:</strong> Date calculation is performed via audited legal math algorithms, eliminating LLM arithmetic mistakes.
                    </span>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gap-2 h-11 text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg cursor-pointer hover:shadow-[0_0_25px_rgba(201,169,97,0.35)] transition-all mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-[#0A0A0B]" />
                        <span>Initializing Transaction Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Document Upload</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Upload Zone */}
        {step === 'upload' && dealId && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Active Transaction Header Banner */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#181822] via-[#14141A] to-[#101014] p-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="gold" className="text-[10px]">
                      Active Workspace
                    </Badge>
                    <span className="text-[11px] font-mono text-[#9A9AA5]">ID: {dealId.slice(0, 8)}...</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#C9A961]" />
                    {propertyAddress || 'Transaction Workspace'}
                  </h3>
                  {(buyerName || sellerName) && (
                    <p className="text-[11px] text-[#9A9AA5]">
                      {buyerName ? `Buyer: ${buyerName}` : ''}
                      {buyerName && sellerName ? ' ↔ ' : ''}
                      {sellerName ? `Seller: ${sellerName}` : ''}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setStep('form')}
                  className="gap-1.5 text-[11px] h-7 self-start sm:self-auto border-white/10 hover:border-white/25"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Edit Details</span>
                </Button>
              </div>
            </div>

            {/* Success Initialized Pill */}
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-3.5 text-xs text-emerald-300 ring-1 ring-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Transaction workspace initialized. Upload the executed Purchase Agreement PDF below to start automatic date extraction.
              </span>
            </div>

            {/* Drop Zone */}
            <UploadZone dealId={dealId} onSuccess={() => setStep('done')} />
          </motion.div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && dealId && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#181822] via-[#141418] to-[#101014] p-8 text-center shadow-2xl space-y-6"
          >
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A961]/15 text-[#C9A961] ring-1 ring-[#C9A961]/30 shadow-[0_0_30px_rgba(201,169,97,0.25)]">
              <CheckCircle2 className="h-8 w-8" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-[#141418]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
                Extraction &amp; Calibration Complete
              </div>
              <h2 className="text-xl font-bold text-[#F5F5F7] tracking-tight sm:text-2xl">
                Contract Ingested &amp; Indexed
              </h2>
              <p className="text-xs text-[#9A9AA5] max-w-md mx-auto leading-relaxed">
                Deterministic deadline calculations, audit trail logging, and page-level citation anchors are active in your workspace.
              </p>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1">
                <div className="text-[10px] font-mono uppercase text-[#6E6E7A] flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Deterministic Math
                </div>
                <div className="text-xs font-semibold text-[#F5F5F7]">100% Verified</div>
                <div className="text-[10px] text-[#9A9AA5]">Statutory WA/CA rules applied</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1">
                <div className="text-[10px] font-mono uppercase text-[#6E6E7A] flex items-center gap-1">
                  <FileText className="h-3 w-3 text-[#C9A961]" />
                  Embeddings
                </div>
                <div className="text-xs font-semibold text-[#F5F5F7]">Citation Ready</div>
                <div className="text-[10px] text-[#9A9AA5]">Page bounding boxes mapped</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1">
                <div className="text-[10px] font-mono uppercase text-[#6E6E7A] flex items-center gap-1">
                  <Clock className="h-3 w-3 text-sky-400" />
                  E&amp;O Guard
                </div>
                <div className="text-xs font-semibold text-[#F5F5F7]">Active Monitoring</div>
                <div className="text-[10px] text-[#9A9AA5]">Alert engine tracking milestones</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => navigate(`/deals/${dealId}/assistant`)}
                size="default"
                className="gap-2 text-xs font-bold uppercase tracking-wider h-10 px-5 shadow-lg hover:shadow-[0_0_20px_rgba(201,169,97,0.35)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Launch AI Copilot</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/deals/${dealId}/review`)}
                size="default"
                className="gap-2 text-xs font-semibold h-10 px-5 border-white/15 hover:border-[#C9A961]/40"
              >
                <span>Verify Deadlines</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/deals')}
                size="default"
                className="text-xs font-semibold h-10 px-4"
              >
                <span>Portfolio View</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
