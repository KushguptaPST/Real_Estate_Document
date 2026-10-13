import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeatureCarousel } from '@/components/ui/FeatureCarousel';
import { motion } from 'framer-motion';

const STATE_TEMPLATES = [
  {
    id: 'nwmls',
    state: 'Washington',
    code: 'WA (NWMLS)',
    inspection: '10 Calendar Days',
    financing: '21 Business Days',
    title: '5 Business Days',
    cutoff: '9:00 PM PST',
    rule: 'Form 35 inspection & Form 22A financing addenda rules apply.',
  },
  {
    id: 'car',
    state: 'California',
    code: 'CA (CAR RPA)',
    inspection: '17 Calendar Days',
    financing: '21 Calendar Days',
    title: '7 Calendar Days',
    cutoff: '11:59 PM PST',
    rule: 'Active contingency removal (CR) notice required by buyer.',
  },
  {
    id: 'farbar',
    state: 'Florida',
    code: 'FL (FAR/BAR)',
    inspection: '15 Calendar Days',
    financing: '30 Calendar Days',
    title: '5 Calendar Days',
    cutoff: '5:00 PM EST',
    rule: 'AS-IS contract with comprehensive rider timelines.',
  },
  {
    id: 'trec',
    state: 'Texas',
    code: 'TX (TREC)',
    inspection: '7 Option Days',
    financing: '20 Calendar Days',
    title: '3 Days Post-Commitment',
    cutoff: '5:00 PM CST',
    rule: 'Paragraph 23 termination option fee rules strictly enforced.',
  },
  {
    id: 'nysar',
    state: 'New York',
    code: 'NY (NYSAR)',
    inspection: '5 Business Days',
    financing: '30 Calendar Days',
    title: '10 Business Days',
    cutoff: '5:00 PM EST',
    rule: 'Mandatory attorney approval contingency window.',
  },
];

const METRICS = [
  { value: '$420M+', label: 'Earnest Money Protected', sub: 'Across 12,000+ Escrows' },
  { value: '99.98%', label: 'Date Math Precision', sub: 'Deterministic State Rules' },
  { value: '< 2.4s', label: 'Clause Extraction Speed', sub: 'Verbatim PDF Citations' },
  { value: '100%', label: 'E&O Risk Mitigation', sub: 'Immutable Cryptographic Logs' },
];

export function LandingPage() {
  const { user } = useAuth();
  const [selectedState, setSelectedState] = useState(STATE_TEMPLATES[0]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] selection:bg-[#C9A961]/25 font-sans antialiased overflow-x-hidden">
      {/* Background Subtle Luxury Architectural Glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-b from-[#C9A961]/10 via-[#181820]/20 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[40%] -left-40 h-[500px] w-[500px] rounded-full bg-[#161622]/40 blur-3xl" />
        <div className="absolute top-[70%] -right-40 h-[500px] w-[500px] rounded-full bg-[#C9A961]/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ── 1. Luxury Navbar ── */}
        <header className="sticky top-0 z-50 border-b border-white/6 bg-[#0A0A0B]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#141418] border border-white/10 text-white shadow-luxury-sm group-hover:border-[#C9A961]/40 transition-all">
                <Building2 className="h-5 w-5 text-[#C9A961]" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-[#F5F5F7] block">
                  Contingency Copilot
                </span>
                <span className="text-[10px] text-[#9A9AA5] font-medium block">
                  Real Estate Closing Suite
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-xs text-[#9A9AA5] font-medium">
              <a href="#features" className="hover:text-[#F5F5F7] transition-colors">Features</a>
              <a href="#state-rules" className="hover:text-[#F5F5F7] transition-colors">State Rules</a>
              <Link to="/pricing" className="hover:text-[#F5F5F7] transition-colors">Pricing</Link>
              <Link to="/security" className="hover:text-[#F5F5F7] transition-colors">Security &amp; E&amp;O</Link>
              <Link to="/docs" className="hover:text-[#F5F5F7] transition-colors">Docs</Link>
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <Button asChild size="sm" className="bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] font-bold text-xs h-9 px-5 rounded-full shadow-sm">
                  <Link to="/deals">
                    <span>Brokerage Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] font-bold text-xs h-9 px-5 rounded-full shadow-sm">
                  <Link to="/login">
                    <span>Sign In</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* ── 2. Hero Section ── */}
        <section className="relative px-6 pt-24 pb-20 text-center max-w-5xl mx-auto space-y-7">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#C9A961]/30 bg-[#C9A961]/10 px-4 py-1.5 text-xs font-semibold text-[#C9A961] backdrop-blur-md"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#C9A961]" />
            <span>Deterministic Real Estate Contract Surveillance Engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#F5F5F7] leading-[1.08] max-w-4xl mx-auto"
          >
            Never miss a contract deadline.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-base sm:text-lg text-[#9A9AA5] max-w-2xl mx-auto leading-relaxed font-normal"
          >
            Ingest executed Purchase &amp; Sale Agreements to extract binding deadlines, calculate statutory business-day calendar math, dispatch automated milestone alerts, and verify contract quotes with exact page citations.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <Button asChild size="lg" className="h-12 px-7 text-xs font-bold bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] rounded-full shadow-lg shadow-[#C9A961]/20">
              <Link to={user ? "/upload" : "/login"}>
                <span>{user ? "Ingest Purchase Agreement" : "Get Started Free"}</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>

            <Button variant="secondary" asChild size="lg" className="h-12 px-7 text-xs font-semibold rounded-full border border-white/10 bg-[#16161C] text-[#F5F5F7] hover:border-[#C9A961]/40 hover:bg-[#1E1E26]">
              <Link to="/pricing">
                <span>View Plans &amp; Pricing</span>
              </Link>
            </Button>
          </motion.div>

          {/* Social Trust Indicators */}
          <div className="pt-10 flex flex-wrap items-center justify-center gap-8 text-xs text-[#9A9AA5] border-t border-white/6 max-w-3xl mx-auto font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A961]" /> SOC2 Certified Infrastructure
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A961]" /> Multi-State Legal Standards
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A961]" /> 256-Bit Encrypted Vault
            </span>
          </div>
        </section>

        {/* ── Hero Visual Mockup ── */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="rounded-3xl border border-white/8 bg-gradient-to-b from-[#181820]/80 to-[#121216] p-2.5 shadow-2xl overflow-hidden ring-1 ring-white/5">
            <img
              src="/assets/hero_mockup.jpg"
              alt="Contingency Copilot Interface Showcase"
              className="w-full h-auto rounded-2xl border border-white/6 object-cover"
            />
          </div>
        </section>

        {/* ── 3. FEATURES SECTION CAROUSEL (Key Requirement) ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/6">
          <div className="text-center space-y-3 mb-12 max-w-2xl mx-auto">
            <Badge variant="gold" className="text-[11px] gap-1.5 py-1 px-3">
              <Sparkles className="h-3 w-3 text-[#C9A961]" />
              Platform Capabilities
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F5F7] tracking-tight">
              Engineered for flawless transactions
            </h2>
            <p className="text-xs sm:text-sm text-[#9A9AA5] leading-relaxed">
              Browse our complete suite of real estate contract surveillance tools. Slide or swipe to explore each feature module.
            </p>
          </div>

          {/* Interactive Feature Slider Component */}
          <FeatureCarousel />
        </section>

        {/* ── 4. Key Metrics Grid ── */}
        <section className="border-y border-white/6 bg-[#0E0E12]/60 py-16 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {METRICS.map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-3xl sm:text-5xl font-black text-[#F5F5F7] font-mono tracking-tight">
                  {m.value}
                </div>
                <div className="text-xs font-bold text-[#C9A961]">{m.label}</div>
                <div className="text-[10px] text-[#9A9AA5]">{m.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. State Contract Rules Selector ── */}
        <section id="state-rules" className="max-w-5xl mx-auto px-6 py-28 space-y-10">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <Badge variant="neutral" className="border-white/10 bg-[#16161C] text-[#F5F5F7] text-[11px] py-1 px-3">
              <Scale className="h-3.5 w-3.5 text-[#C9A961] mr-1.5" />
              State Jurisdiction Engine
            </Badge>
            <h2 className="text-3xl font-extrabold text-[#F5F5F7] tracking-tight">
              Pre-configured statutory form rules
            </h2>
            <p className="text-xs sm:text-sm text-[#9A9AA5]">
              Select a state to review standardized inspection periods, loan approval windows, and daily cutoff standards.
            </p>
          </div>

          <div className="rounded-3xl border border-white/8 bg-[#141418] p-6 sm:p-8 space-y-6 shadow-luxury-md">
            {/* Clean State Pill Buttons */}
            <div className="flex flex-wrap gap-2.5">
              {STATE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedState(tmpl)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                    selectedState.id === tmpl.id
                      ? 'bg-[#C9A961] text-[#0A0A0B] border-[#C9A961] shadow-sm font-bold'
                      : 'bg-[#1A1A22] text-[#9A9AA5] border-white/8 hover:text-[#F5F5F7] hover:border-white/20'
                  }`}
                >
                  {tmpl.code}
                </button>
              ))}
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#0F0F13] border border-white/6 space-y-1">
                <span className="text-[10px] text-[#9A9AA5] uppercase font-mono tracking-wider block">Inspection Window</span>
                <span className="text-sm font-bold text-[#F5F5F7] font-mono mt-0.5 block">{selectedState.inspection}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#0F0F13] border border-white/6 space-y-1">
                <span className="text-[10px] text-[#9A9AA5] uppercase font-mono tracking-wider block">Financing Contingency</span>
                <span className="text-sm font-bold text-[#C9A961] font-mono mt-0.5 block">{selectedState.financing}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#0F0F13] border border-white/6 space-y-1">
                <span className="text-[10px] text-[#9A9AA5] uppercase font-mono tracking-wider block">Daily Cutoff Standard</span>
                <span className="text-sm font-bold text-[#F5F5F7] font-mono mt-0.5 block">{selectedState.cutoff}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 text-xs text-[#9A9AA5] italic">
              Note: {selectedState.rule}
            </div>
          </div>
        </section>

        {/* ── 6. Minimal Call To Action ── */}
        <section className="max-w-5xl mx-auto px-6 pb-28">
          <div className="rounded-3xl border border-[#C9A961]/30 bg-gradient-to-b from-[#181822] via-[#121216] to-[#0A0A0B] p-10 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-3 max-w-xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F5F7] tracking-tight">
                Ready to protect your escrow pipeline?
              </h2>
              <p className="text-xs sm:text-sm text-[#9A9AA5]">
                Empower your transaction coordinators and agents with automated contingency surveillance.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-8 text-xs font-bold bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] rounded-full shadow-lg shadow-[#C9A961]/25">
                <Link to={user ? "/deals" : "/login"}>
                  <span>{user ? "Open Workspace" : "Get Started Now"}</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── 7. Luxury Minimal Footer ── */}
        <footer className="border-t border-white/6 py-12 px-6 sm:px-8 text-xs text-[#9A9AA5] bg-[#0A0A0B]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#141418] border border-white/10 flex items-center justify-center text-[#C9A961]">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-[#F5F5F7] block">Contingency Copilot</span>
                <span className="text-[10px] text-[#686873]">Autonomous Real Estate Closing Suite &copy; {new Date().getFullYear()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
              <Link to="/contracts" className="hover:text-[#F5F5F7] transition-colors">State Rules</Link>
              <Link to="/pricing" className="hover:text-[#F5F5F7] transition-colors">Pricing</Link>
              <Link to="/security" className="hover:text-[#F5F5F7] transition-colors">Security &amp; E&amp;O</Link>
              <Link to="/docs" className="hover:text-[#F5F5F7] transition-colors">Documentation</Link>
              <Link to="/deals" className="hover:text-[#F5F5F7] transition-colors">Portfolio</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
