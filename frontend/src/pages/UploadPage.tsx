import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealsApi } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { UploadZone } from '@/components/UploadZone';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
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
import { StatutoryDatePicker, calculateStatutoryDayOne } from '@/components/ui/StatutoryDatePicker';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'upload'>('form');
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
    { key: 'upload', label: 'Contract Ingestion', desc: 'PDF Document & Auto-Extraction' },
  ] as const;
  const stepIndex = steps.findIndex((s) => s.key === step);

  const handleUploadSuccess = () => {
    toast.success(
      'Contract Ingested & Analyzed',
      'Contingency deadlines and statutory calendar generated.'
    );
    navigate(`/deals/${dealId}`);
  };

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-4 space-y-8">
      {/* Subtle Luxury Ambient Radial Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_70%)]" />

      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
            Transaction Intake
          </span>
          <Badge variant="neutral" className="text-[10px] border-slate-200 bg-slate-100 text-slate-700 font-bold">
            Step {stepIndex + 1} of 2
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-mono font-medium ml-auto">
            <Lock className="h-3.5 w-3.5 text-emerald-700" />
            256-Bit Encrypted Escrow Room
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Ingest Purchase Agreement
        </h1>
        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
          Enter transaction counterparties and upload your executed PDF contract. Contingency calendar deadlines and statutory rules are calculated deterministically.
        </p>
      </div>

      {/* Segmented Stepper Indicator */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
          {steps.map((s, i) => {
            const isCompleted = i < stepIndex;
            const isCurrent = i === stepIndex;

            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-slate-50 border border-slate-300 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/50 border border-emerald-200/80'
                    : 'bg-transparent border border-transparent opacity-60'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-mono font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isCurrent
                      ? 'bg-[#0A0A0A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 text-emerald-800" /> : i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold truncate ${isCurrent ? 'text-slate-950 font-bold' : isCompleted ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
                    {s.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
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
            <Card className="border-slate-200/90 bg-white shadow-2xl backdrop-blur-xl">
              <CardHeader className="pb-5 border-b border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-700" />
                      Transaction Counterparties &amp; Terms
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Primary metadata used for calculating business-day calendars and drafting reminder notices.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={fillSampleDeal}
                    className="gap-1.5 text-[11px] h-8 px-3 border-slate-200 bg-emerald-50 text-emerald-800 text-emerald-700 hover:bg-emerald-100 hover:border-slate-400 self-start sm:self-auto cursor-pointer transition-all"
                  >
                    <Zap className="h-3 w-3 text-emerald-700" />
                    <span>Auto-Fill Sample (WA Form 21)</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={(e) => void handleDealCreate(e)} className="space-y-5">
                  {/* Property Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                        Property Address <span className="text-rose-400">*</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Full Legal / MLS Address</span>
                    </label>
                    <Input
                      required
                      placeholder="e.g. 1420 Evergreen Vista Way, Bellevue, WA 98004"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      className="h-10 text-xs"
                    />
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-400">Supported MLS / Board standards:</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 border border-white/5">NWMLS</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 border border-white/5">CAR California</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 border border-white/5">TREC Texas</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 border border-white/5">NY MLS</span>
                    </div>
                  </div>

                  {/* Buyer & Seller Counterparties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-700" />
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
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-700" />
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
                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                        Contract Mutual Acceptance Date (Day 0)
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Statutory Window Anchor</span>
                    </label>

                    {/* Bespoke Real Estate Statutory Date Picker */}
                    <StatutoryDatePicker
                      value={acceptanceDate}
                      onChange={setAcceptanceDate}
                      placeholder="Select Mutual Acceptance Date (e.g. Oct 31, 2026)..."
                    />

                    {/* Live Day 0 / Day 1 Statutory Calculation Badge */}
                    {acceptanceDate && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950 shadow-2xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white text-[10px] font-bold">
                            D0
                          </span>
                          <span className="font-bold">
                            Mutual Acceptance: {format(parseISO(acceptanceDate), 'EEE, MMM d, yyyy')}
                          </span>
                        </div>
                        {calculateStatutoryDayOne(acceptanceDate) && (
                          <span className="text-[11px] font-semibold text-emerald-800 bg-white/90 px-2.5 py-1 rounded-md border border-emerald-200/80 self-start sm:self-auto shadow-2xs">
                            Day 1 begins: {calculateStatutoryDayOne(acceptanceDate)?.formattedDayOne}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Explanatory E&O callout box */}
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3.5 text-xs text-slate-700 shadow-2xs">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 mt-0.5 border border-slate-300/60">
                        <Info className="h-3.5 w-3.5 text-slate-700" />
                      </div>
                      <div className="space-y-1 text-xs leading-relaxed">
                        <p className="text-slate-900 font-medium">
                          The date mutual acceptance was finalized. Used as{' '}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold text-slate-900 bg-slate-200 border border-slate-300 text-[11px]">
                            Day 0
                          </span>{' '}
                          to calculate relative business/calendar day windows.
                        </p>
                        <p className="text-slate-600 text-[11px]">
                          Per standard practice (e.g. WA RCW 64.06), Day 1 begins on the next business day. All state legal holidays and 9:00 PM cutoff rules are deterministically applied.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* E&O Compliance Strip */}
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 shadow-2xs">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-800" />
                    </div>
                    <span className="text-[11px] leading-snug">
                      <strong className="font-bold text-emerald-950">Deterministic E&amp;O Protection:</strong>{' '}
                      <span className="text-emerald-900 font-medium">
                        Date calculation is performed via audited legal math algorithms, eliminating LLM arithmetic mistakes.
                      </span>
                    </span>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 shadow-2xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
                      <span className="font-bold">{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gap-2 h-11 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs cursor-pointer bg-[#0A0A0A] hover:bg-black text-white transition-all mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active Workspace
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">ID: {dealId.slice(0, 8)}...</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    {propertyAddress || 'Transaction Workspace'}
                  </h3>
                  {(buyerName || sellerName) && (
                    <p className="text-xs text-slate-500">
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
                  className="gap-1.5 text-xs font-semibold h-8 self-start sm:self-auto border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Edit Details</span>
                </Button>
              </div>
            </div>

            {/* Success Initialized Pill */}
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="font-medium">
                Transaction workspace initialized. Upload the executed Purchase Agreement PDF below to start automatic date extraction.
              </span>
            </div>

            {/* Drop Zone */}
            <UploadZone dealId={dealId} onSuccess={handleUploadSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
