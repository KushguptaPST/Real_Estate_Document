import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealsApi, documentsApi } from '@/services/api';
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
  UploadCloud,
  ChevronDown,
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

  // Fast-track direct upload states
  const [directDragging, setDirectDragging] = useState(false);
  const [directUploading, setDirectUploading] = useState(false);
  const [directStage, setDirectStage] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const directInputRef = useRef<HTMLInputElement>(null);

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

  async function handleDirectUpload(file: File, overrideAddress?: string) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }

    setDirectUploading(true);
    setSubmitting(true);
    setError(null);
    setDirectStage('Reading contract PDF & initializing escrow room...');

    try {
      const address =
        overrideAddress ||
        propertyAddress.trim() ||
        file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') ||
        'Executed Purchase Agreement';

      const deal = await dealsApi.create({
        propertyAddress: address,
        buyerName: buyerName.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
        acceptanceDate: acceptanceDate || new Date().toISOString().split('T')[0],
      });

      setDealId(deal.id);
      setDirectStage('Uploading PDF & running AI clause extraction pipeline...');

      await documentsApi.upload(deal.id, file);

      setDirectStage('Generating deterministic contingency calendars...');
      toast.success(
        'Contract Ingested & Analyzed',
        'Contingency deadlines and statutory calendar generated.'
      );

      setTimeout(() => {
        navigate(`/deals/${deal.id}`);
      }, 500);
    } catch (err) {
      setError((err as Error).message);
      setDirectUploading(false);
      setSubmitting(false);
    }
  }

  async function handleLoadSampleContract() {
    setDirectUploading(true);
    setError(null);
    setDirectStage('Loading sample WA Form 21 contract agreement...');
    try {
      const res = await fetch('/sample-contract.pdf');
      const blob = await res.blob();
      const file = new File(
        [blob],
        'NWMLS_Form21_Purchase_Agreement_1420_Evergreen.pdf',
        { type: 'application/pdf' }
      );
      await handleDirectUpload(file, '1420 Evergreen Vista Way, Bellevue, WA 98004');
    } catch (err) {
      setError('Failed to load sample contract: ' + (err as Error).message);
      setDirectUploading(false);
    }
  }

  async function handleDealCreate(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const address = propertyAddress.trim() || 'New Executed Purchase Agreement';

    setSubmitting(true);
    setError(null);

    try {
      const deal = await dealsApi.create({
        propertyAddress: address,
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
    { key: 'form', label: 'Upload or Specify Entities', desc: 'PDF Document & Metadata' },
    { key: 'upload', label: 'Contract Analysis & Review', desc: 'Deadlines & Risk Engine' },
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
                onClick={() => {
                  if (s.key === 'form') {
                    setStep('form');
                  } else if (s.key === 'upload') {
                    if (dealId) {
                      setStep('upload');
                    } else {
                      void handleDealCreate();
                    }
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-50 border border-slate-300 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/50 border border-emerald-200/80 hover:bg-emerald-50'
                    : 'bg-transparent border border-slate-100 hover:bg-slate-50/80 opacity-80'
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
                  <div className={`text-xs font-bold truncate ${isCurrent ? 'text-slate-950 font-bold' : isCompleted ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}>
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
        {/* Step 1: Form & Direct PDF Upload */}
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── Direct 1-Click PDF Contract Ingestion Dropzone ── */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDirectDragging(true);
              }}
              onDragLeave={() => setDirectDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDirectDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleDirectUpload(file);
              }}
              className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-8 transition-all text-center ${
                directDragging
                  ? 'border-emerald-500 bg-emerald-50/80 scale-[1.01] shadow-lg'
                  : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/40 shadow-sm'
              }`}
            >
              {/* Hidden Native File Input */}
              <input
                ref={directInputRef}
                id="contract-pdf-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDirectUpload(file);
                }}
              />

              {directUploading ? (
                /* Processing State */
                <div className="py-6 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">
                      Processing Contract Agreement
                    </h3>
                    <p className="text-xs text-slate-600 font-mono">
                      {directStage || 'Analyzing PDF and extracting statutory windows...'}
                    </p>
                  </div>
                  <div className="mx-auto max-w-xs w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              ) : (
                /* Ready State */
                <div className="space-y-5">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200">
                    <UploadCloud className="h-7 w-7 text-slate-700" />
                  </div>

                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      Drop Executed Purchase Agreement PDF here
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Upload your signed contract PDF. Our AI engine extracts counterparties, earnest money, financing terms, and statutory contingency deadlines automatically.
                    </p>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <Button
                      type="button"
                      onClick={() => directInputRef.current?.click()}
                      className="gap-2 h-11 px-6 rounded-xl bg-[#0A0A0A] hover:bg-black text-white font-bold text-xs shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
                    >
                      <UploadCloud className="h-4 w-4 text-emerald-400" />
                      <span>Browse Contract PDF</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleLoadSampleContract()}
                      className="gap-2 h-11 px-5 rounded-xl border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer transition-all hover:-translate-y-0.5"
                    >
                      <Zap className="h-4 w-4 text-emerald-600" />
                      <span>1-Click Test (WA Form 21 Sample)</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400 font-mono">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>NWMLS Form 21 &bull; California CAR &bull; Texas TREC &bull; New York MLS</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 shadow-2xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
                <span className="font-bold flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-600 hover:text-rose-900 text-xs font-semibold px-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── Collapsible / Optional Manual Terms Form ── */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-700" />
                      Transaction Counterparties &amp; Metadata (Optional)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      You can enter property and counterparty names now or let the document parser extract them from the PDF.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={fillSampleDeal}
                    className="gap-1.5 text-[11px] h-8 px-3 border-slate-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-slate-400 self-start sm:self-auto cursor-pointer transition-all"
                  >
                    <Zap className="h-3 w-3 text-emerald-700" />
                    <span>Auto-Fill Sample (WA Form 21)</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-5">
                <form noValidate onSubmit={(e) => void handleDealCreate(e)} className="space-y-4">
                  {/* Property Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                        Property Address <span className="text-slate-400 font-normal">(Optional if uploading PDF)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Full Legal / MLS Address</span>
                    </label>
                    <Input
                      placeholder="e.g. 1420 Evergreen Vista Way, Bellevue, WA 98004"
                      value={propertyAddress}
                      onChange={(e) => {
                        setPropertyAddress(e.target.value);
                        if (error) setError(null);
                      }}
                      className="h-10 text-xs"
                    />
                  </div>

                  {/* Buyer & Seller Counterparties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-700" />
                        Buyer Full Name / Purchasing Entity
                      </label>
                      <Input
                        placeholder="e.g. Alexander &amp; Elena Vance"
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
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                        Contract Mutual Acceptance Date (Day 0)
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Statutory Window Anchor</span>
                    </label>

                    <StatutoryDatePicker
                      value={acceptanceDate}
                      onChange={setAcceptanceDate}
                      placeholder="Select Mutual Acceptance Date (e.g. Oct 31, 2026)..."
                    />

                    {acceptanceDate && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-950 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white text-[10px] font-bold">
                            D0
                          </span>
                          <span className="font-bold">
                            Mutual Acceptance: {format(parseISO(acceptanceDate), 'EEE, MMM d, yyyy')}
                          </span>
                        </div>
                        {calculateStatutoryDayOne(acceptanceDate) && (
                          <span className="text-[11px] font-semibold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200/80 self-start sm:self-auto">
                            Day 1 begins: {calculateStatutoryDayOne(acceptanceDate)?.formattedDayOne}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

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
