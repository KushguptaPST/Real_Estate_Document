import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  PhoneCall,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  Lock,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  FileText,
  Mail,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const LIFECYCLE_STAGES = [
  {
    step: '01',
    id: 'capture',
    badge: 'Front-Office Speed-to-Lead',
    title: 'Inbound AI Capture & Voice Memos',
    headline: 'Engage buyer leads in under 60 seconds across WhatsApp & Telegram.',
    description:
      'When an inquiry lands from Zillow, Meta Ads, or your website, our AI Sales Copilot responds immediately with natural spoken voice notes and authentic text—never robotic templates.',
    metrics: [
      { label: 'Response Latency', value: '< 45s' },
      { label: 'Channels', value: 'WhatsApp, Telegram, Web' },
      { label: 'Audio Engine', value: 'Neural TTS + Waveform' },
    ],
  },
  {
    step: '02',
    id: 'qualify',
    badge: 'Consultative GraphRAG',
    title: 'Preference Memory & Tour Booking',
    headline: 'Qualify budgets, match off-market units, and book in-person tours.',
    description:
      'The AI maintains a structured Fact-Provenance Memory Model, stretches budgets realistically across micro-markets, and books conflict-free property walkthroughs directly into advisor calendars.',
    metrics: [
      { label: 'Memory Provenance', value: 'BUYER_STATED' },
      { label: 'Booking Logic', value: 'Zero-Conflict Calendar' },
      { label: 'Location Dispatch', value: 'Instant Map Pin Delivery' },
    ],
  },
  {
    step: '03',
    id: 'convert',
    badge: 'Atomic PostgreSQL Transition',
    title: '1-Click Lead-to-Deal Conversion',
    headline: 'Turn qualified buyers into executed transactions without race conditions.',
    description:
      'When a contract is signed, convert the lead into an active escrow deal with one click. Our database atomically updates lead status to WON, creates the closing record, and locks property inventory.',
    metrics: [
      { label: 'Concurrency Lock', value: 'ACID Guaranteed' },
      { label: 'Data Integrity', value: 'Zero Double-Conversion' },
      { label: 'Audit Logging', value: '37 Mutation Actions' },
    ],
  },
  {
    step: '04',
    id: 'surveillance',
    badge: 'Back-Office Escrow Defense',
    title: 'Statutory Contingency Surveillance',
    headline: 'Eliminate E&O claims and protect buyer earnest money deposits.',
    description:
      'Copilot parses executed agreements, factors 50-state statutory banking holidays and daily cutoff times, and dispatches automated alerts to title and lenders so earnest money is never forfeited.',
    metrics: [
      { label: 'Statutory Standard', value: 'NWMLS, CAR, FAR/BAR, TREC' },
      { label: 'Anti-Hallucination', value: 'Verbatim Line Citations' },
      { label: 'E&O Protection', value: '15% Insurance Credit' },
    ],
  },
];

export function PinnedWorkflowShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: '+=2200',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          if (p < 0.25) setCurrentStep(0);
          else if (p < 0.5) setCurrentStep(1);
          else if (p < 0.75) setCurrentStep(2);
          else setCurrentStep(3);
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const activeStage = LIFECYCLE_STAGES[currentStep];

  return (
    <section
      id="workflow"
      ref={containerRef}
      className="relative w-full min-h-screen bg-[#F8F9FA] flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24 overflow-hidden border-y border-[#E5E7EB]"
    >
      <div className="max-w-6xl mx-auto w-full space-y-8 sm:space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-zinc-200/90 bg-white px-3.5 py-1 text-xs font-medium tracking-wide text-zinc-800 shadow-2xs">
            <span>Complete Real Estate Revenue Lifecycle</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0A0A0A] leading-[1.08]">
            From first lead click to final escrow closing.
          </h2>
          <p className="text-sm sm:text-base text-[#52525B] leading-relaxed max-w-[62ch] mx-auto">
            Experience how Contingency Copilot unifies autonomous front-office lead sales with bulletproof back-office transaction surveillance.
          </p>
        </div>

        {/* ── Segmented Interactive 4-Step Dock ── */}
        <div className="max-w-4xl mx-auto w-full">
          <div className="p-1.5 rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {LIFECYCLE_STAGES.map((s, idx) => {
              const isSelected = currentStep === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`relative py-3 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'text-[#0A0A0A] font-bold shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeLifecycleTab"
                      className="absolute inset-0 bg-[#F4F4F5] rounded-xl border border-zinc-200/90"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                    <span>STEP {s.step}</span>
                  </div>
                  <span className="relative z-10 block truncate font-sans text-xs">
                    {s.title.split(' ')[0]} {s.title.split(' ')[1]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main Showcase Application Window ── */}
        <div className="rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_25px_60px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Top Window Bar */}
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-zinc-300" />
              <span className="h-3 w-3 rounded-full bg-zinc-300" />
              <span className="h-3 w-3 rounded-full bg-zinc-300" />
              <span className="ml-3 text-zinc-800 font-bold hidden sm:inline">
                Lifecycle Stage {activeStage.step}: {activeStage.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-zinc-700 bg-white px-3 py-1 rounded-full border border-zinc-200 text-[10px] font-semibold shadow-2xs">
                {activeStage.badge}
              </span>
            </div>
          </div>

          {/* Interactive Workspace Area */}
          <div className="p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Context, Narrative & Key Metrics */}
              <div className="lg:col-span-5 space-y-6 text-left">
                <div className="space-y-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-emerald-700 block">
                    STAGE {activeStage.step} &bull; {activeStage.badge}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
                    {activeStage.headline}
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed pt-1">
                    {activeStage.description}
                  </p>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100">
                  {activeStage.metrics.map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-0.5">
                      <span className="text-[9px] font-mono uppercase text-zinc-400 block font-semibold">
                        {m.label}
                      </span>
                      <strong className="text-xs font-bold text-zinc-900 block truncate">
                        {m.value}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Navigation Stepper */}
                <div className="pt-2 flex items-center justify-between text-xs border-t border-zinc-100 text-zinc-400 font-mono">
                  <span>STEP {activeStage.step} OF 04</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentStep === 0}
                      onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans font-semibold text-zinc-700 inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentStep === 3}
                      onClick={() => setCurrentStep((prev) => Math.min(3, prev + 1))}
                      className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans font-semibold inline-flex items-center gap-1 shadow-xs"
                    >
                      <span>Next Stage</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Artifact */}
              <div className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  {/* Stage 1: Speed to Lead Voice Note */}
                  {currentStep === 0 && (
                    <motion.div
                      key="step-0"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-2xl bg-[#FAF9F6] border border-[#E5E7EB] p-5 sm:p-6 space-y-4 text-left shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            AI
                          </span>
                          <div>
                            <span className="text-xs font-bold text-zinc-900 block">
                              Inbound Lead: Liam Chen
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Meta Lead Ad &bull; Instant WhatsApp Outreach
                            </span>
                          </div>
                        </div>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-mono">
                          Response Time: 32s
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-2 shadow-2xs">
                        <div className="text-[10px] font-mono text-zinc-400 uppercase">Spoken Voice Memo Delivered</div>
                        <p className="text-xs text-zinc-800 italic font-serif leading-relaxed">
                          &ldquo;Hey Liam! Saw your inquiry on the 3-bed in Bellevue. That exact floor plan is touring this weekend. I can walk you through Saturday at 11:00 AM if you have 20 minutes?&rdquo;
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
                        <span className="font-medium">Lead Qualification Status:</span>
                        <strong className="font-mono text-emerald-800 font-bold">QUALIFIED &bull; BUDGET VERIFIED</strong>
                      </div>
                    </motion.div>
                  )}

                  {/* Stage 2: Showing Scheduler */}
                  {currentStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-2xl bg-[#FAF9F6] border border-[#E5E7EB] p-5 sm:p-6 space-y-4 text-left shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-emerald-700" />
                          <div>
                            <span className="text-xs font-bold text-zinc-900 block">
                              Showing Scheduled &bull; 1042 108th Ave NE
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Saturday, Nov 01 &bull; 11:00 AM &ndash; 11:45 AM PST
                            </span>
                          </div>
                        </div>
                        <span className="text-emerald-800 font-bold bg-emerald-100/70 px-2.5 py-0.5 rounded-full text-[10px] font-mono">
                          CALENDAR LOCKED
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                          <span className="text-zinc-600">Assigned Broker:</span>
                          <strong className="text-zinc-900">Sarah Jenkins (Compass)</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                          <span className="text-zinc-600">Buyer Preferences:</span>
                          <strong className="text-zinc-900">3BHK, $1.3M, Bellevue Schools</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between shadow-2xs">
                          <span className="text-zinc-600">Dispatched Assets:</span>
                          <strong className="text-emerald-700">Google Maps Pin + Floor Plan PDF</strong>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Stage 3: Atomic Deal Conversion */}
                  {currentStep === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-2xl bg-[#FAF9F6] border border-[#E5E7EB] p-5 sm:p-6 space-y-4 text-left shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-zinc-900" />
                          <div>
                            <span className="text-xs font-bold text-zinc-900 block">
                              Lead Converted &rarr; Active Escrow Deal #88219
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Atomic PostgreSQL `$transaction` Executed
                            </span>
                          </div>
                        </div>
                        <span className="text-zinc-900 font-bold bg-zinc-200/80 px-2 py-0.5 rounded text-[11px] font-mono">
                          STATUS: WON
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-2.5 text-xs font-mono shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-700">
                          <span>1. Lead Status:</span>
                          <span className="text-emerald-700 font-bold">WON (Liam Chen)</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-700">
                          <span>2. Property Status:</span>
                          <span className="text-amber-800 font-bold">UNDER_CONTRACT (Locked)</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-700">
                          <span>3. Escrow Record:</span>
                          <span className="text-zinc-900 font-bold">Created with P&amp;S Agreement</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-100 text-[11px] font-mono text-zinc-600 flex items-center justify-between">
                        <span>Database Constraint:</span>
                        <strong>@unique(leadId) &bull; Zero Race Conditions</strong>
                      </div>
                    </motion.div>
                  )}

                  {/* Stage 4: Escrow Contingency Surveillance */}
                  {currentStep === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-2xl bg-white border border-emerald-300 p-5 sm:p-6 space-y-4 text-left shadow-[0_20px_50px_rgba(16,185,129,0.09)]"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold tracking-wider block">
                            Back-Office Surveillance Active
                          </span>
                          <h4 className="text-sm font-bold text-zinc-900 font-sans">
                            Inspection Contingency &bull; Form 35
                          </h4>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          $45,000 Protected
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-[#F8F9FA] border border-zinc-200 space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500 uppercase text-[10px]">Statutory Deadline</span>
                          <span className="text-emerald-700 font-bold">Monday, Nov 04 at 9:00 PM PST</span>
                        </div>
                        <div className="text-xl font-bold text-zinc-900 font-mono flex items-center gap-2">
                          <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>3 Days, 08 Hours Left</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-zinc-200 text-xs font-mono flex items-center justify-between">
                        <span>Verbatim Citation:</span>
                        <strong className="text-zinc-900">NWMLS Form 35, Pg 4, Line 18</strong>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
