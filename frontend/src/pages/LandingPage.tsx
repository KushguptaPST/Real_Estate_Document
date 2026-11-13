import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Scale,
  ChevronDown,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { Hero3DCanvas } from '@/components/landing/Hero3DCanvas';
import { HeroDualTerminal } from '@/components/landing/HeroDualTerminal';
import { PinnedWorkflowShowcase } from '@/components/landing/PinnedWorkflowShowcase';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { BrokerageRoiCalculator } from '@/components/landing/BrokerageRoiCalculator';
import { PublicHeader } from '@/components/landing/PublicHeader';
import { EigenEstateIcon } from '@/components/brand/EigenEstateLogo';
import { BrokerageTestimonials } from '@/components/landing/BrokerageTestimonials';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const TRUSTED_BROKERAGES = [
  'COMPASS',
  "SOTHEBY'S INTERNATIONAL REALTY",
  'eXp REALTY',
  'KELLER WILLIAMS',
  'COLDWELL BANKER',
  'FIRST AMERICAN TITLE',
  'FIDELITY NATIONAL TITLE',
  'CHICAGO TITLE',
];

const STATE_TEMPLATES = [
  {
    id: 'nwmls',
    state: 'Washington',
    code: 'WA (NWMLS)',
    inspection: '10 Calendar Days',
    financing: '21 Business Days',
    title: '5 Business Days',
    cutoff: '9:00 PM PST',
    rule: 'Form 35 inspection & Form 22A financing addenda rules strictly enforced. 9:00 PM statutory cutoff.',
  },
  {
    id: 'car',
    state: 'California',
    code: 'CA (CAR RPA)',
    inspection: '17 Calendar Days',
    financing: '21 Calendar Days',
    title: '7 Calendar Days',
    cutoff: '11:59 PM PST',
    rule: 'Active contingency removal (CR) notice required by buyer. Contingencies never expire passively.',
  },
  {
    id: 'farbar',
    state: 'Florida',
    code: 'FL (FAR/BAR)',
    inspection: '15 Calendar Days',
    financing: '30 Calendar Days',
    title: '5 Calendar Days',
    cutoff: '5:00 PM EST',
    rule: 'AS-IS contract with comprehensive rider timelines. 5:00 PM statutory daily cutoff standard.',
  },
  {
    id: 'trec',
    state: 'Texas',
    code: 'TX (TREC)',
    inspection: '7 Option Days',
    financing: '20 Calendar Days',
    title: '3 Days Post-Commitment',
    cutoff: '5:00 PM CST',
    rule: 'Paragraph 23 termination option fee rules strictly enforced with 5:00 PM CST cutoff.',
  },
  {
    id: 'nysar',
    state: 'New York',
    code: 'NY (NYSAR)',
    inspection: '5 Business Days',
    financing: '30 Calendar Days',
    title: '10 Business Days',
    cutoff: '5:00 PM EST',
    rule: 'Mandatory attorney approval contingency window before purchase agreement becomes binding.',
  },
];

const METRICS = [
  { value: '< 45s', label: 'AI Speed-to-Lead Response', sub: 'WhatsApp & Telegram Outreach' },
  { value: '$420M+', numeric: 420, label: 'Earnest Money Protected', sub: 'Across 12,000+ Escrows' },
  { value: '99.98%', label: 'Statutory Date Precision', sub: 'Deterministic State Rules' },
  { value: '100%', label: 'E&O Risk Mitigation', sub: 'Immutable Cryptographic Logs' },
];

export function LandingPage() {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [selectedState, setSelectedState] = useState(STATE_TEMPLATES[0]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── 1. Lenis Smooth Scrolling Engine ─────────────────────────────────────
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const tickerCb = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
    };
  }, []);

  // ── 2. GSAP Master Timeline & Scroll Choreography ────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero Entrance Timeline
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .from('.gsap-hero-eyebrow', {
          opacity: 0,
          y: -16,
          duration: 0.6,
        })
        .from(
          '.gsap-hero-title',
          {
            opacity: 0,
            y: 35,
            duration: 0.9,
          },
          '-=0.3',
        )
        .from(
          '.gsap-hero-desc',
          {
            opacity: 0,
            y: 20,
            duration: 0.8,
          },
          '-=0.6',
        )
        .from(
          '.gsap-hero-actions',
          {
            opacity: 0,
            y: 16,
            duration: 0.7,
            stagger: 0.1,
          },
          '-=0.5',
        );

      // Infinite Marquee Ticker
      if (marqueeRef.current) {
        gsap.to(marqueeRef.current, {
          xPercent: -50,
          duration: 25,
          ease: 'none',
          repeat: -1,
        });
      }

      // Metric Counter Scrub Animation
      const countElements = document.querySelectorAll('.gsap-metric-counter');
      countElements.forEach((el) => {
        const val = el.getAttribute('data-numeric');
        if (val === '420') {
          const counterObj = { count: 0 };
          gsap.to(counterObj, {
            count: 420,
            duration: 2,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
            onUpdate: () => {
              el.textContent = `$${Math.round(counterObj.count)}M+`;
            },
          });
        }
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900 overflow-x-hidden relative"
    >
      {/* ── 1. Minimalist High-Craft Header (Wispr Flow Standard) ── */}
      <PublicHeader />

      {/* ── 2. Hero Section: Clean, Authoritative & Professional ── */}
      <section className="relative min-h-[92vh] flex flex-col justify-center items-center px-4 sm:px-6 pt-28 sm:pt-32 pb-24 text-center overflow-hidden">
        {/* Subtle, High-FPS Three.js Glass Geometry */}
        <Hero3DCanvas />

        <div className="relative z-10 max-w-5xl mx-auto space-y-8">
          {/* Eyebrow Badge */}
          <div className="gsap-hero-eyebrow inline-flex items-center rounded-full border border-zinc-200/90 bg-zinc-100 px-3.5 py-1 text-xs font-medium tracking-wide text-zinc-800">
            <span>Autonomous Real Estate AI &bull; Inbound Sales Copilot &bull; 50-State Statutory Escrow Engine</span>
          </div>

          {/* Authoritative Display Heading */}
          <h1 className="gsap-hero-title text-5xl sm:text-7xl lg:text-8xl font-bold tracking-[-0.035em] text-[#0A0A0A] leading-[1.06] max-w-4xl mx-auto">
            Qualify every lead. Close every deal.{' '}
            <span className="text-[#047857] block sm:inline">
              Protect every deposit.
            </span>
          </h1>

          {/* Scannable Enterprise Body Copy */}
          <p className="gsap-hero-desc text-base sm:text-lg text-[#52525B] max-w-[64ch] mx-auto leading-relaxed font-normal">
            Engage inbound buyer inquiries in seconds with hyper-realistic voice memos and automated showing bookings. Then lock in every closing milestone with deterministic statutory escrow surveillance.
          </p>

          {/* Interactive Hero CTAs */}
          <div className="gsap-hero-actions flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to={user ? '/deals' : '/signup'}
              className="inline-flex items-center justify-center gap-2 h-12 px-7 text-xs font-semibold rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-all hover:-translate-y-0.5 shadow-sm cursor-pointer"
            >
              <span>{user ? 'Open Brokerage Pipeline' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {!user && (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-xs font-semibold rounded-full border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span>Sign In to Platform</span>
              </Link>
            )}

            <a
              href="#workflow"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 text-xs font-semibold rounded-full border border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-zinc-50 transition-all shadow-2xs"
            >
              <span>Explore Platform Lifecycle</span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-8 text-xs text-[#52525B] border-t border-[#E5E7EB]/80 max-w-3xl mx-auto font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sub-60s Speed-to-Lead
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Neural Voice Memos
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 50-State Statutory Engine
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 100% E&amp;O Audit Shield
            </span>
          </div>

          {/* ── Interactive Dual-Superpower Terminal (Sales + Escrow) ── */}
          <div className="pt-6 w-full">
            <HeroDualTerminal />
          </div>
        </div>
      </section>

      {/* ── 3. Brokerage Trust Marquee (GSAP Infinite Ticker) ── */}
      <section className="border-y border-[#E5E7EB] bg-[#FAF9F6] py-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold px-6 shrink-0 hidden sm:inline">
            PROTECTING TRANSACTIONS AT:
          </span>
          <div className="overflow-hidden flex-1 relative">
            <div ref={marqueeRef} className="flex gap-14 whitespace-nowrap will-change-transform">
              {[...TRUSTED_BROKERAGES, ...TRUSTED_BROKERAGES].map((name, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold font-mono tracking-wider text-zinc-400 hover:text-zinc-800 transition-colors cursor-default"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Key Financial & Legal Metrics (GSAP Scrubbed) ── */}
      <section className="bg-white py-16 px-6 border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {METRICS.map((m, i) => (
            <div key={i} className="space-y-1.5">
              <div
                data-numeric={m.numeric}
                className="gsap-metric-counter text-4xl sm:text-5xl font-bold text-[#0A0A0A] tracking-tight font-mono"
              >
                {m.value}
              </div>
              <div className="text-xs font-bold text-[#0A0A0A] font-sans">{m.label}</div>
              <div className="text-[11px] text-[#A1A1AA] font-sans">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. GSAP Pinned Interactive Workflow Showcase (Before -> Process -> Output) ── */}
      <PinnedWorkflowShowcase />

      {/* ── 6. Minimalist Bento Grid Architecture ── */}
      <BentoFeatures />

      {/* ── 7. Brokerage ROI & Risk Shield Calculator ── */}
      <BrokerageRoiCalculator />

      {/* ── 8. State Contract Rules Selector ── */}
      <section id="state-rules" className="max-w-5xl mx-auto px-6 py-28 space-y-10 border-t border-[#E5E7EB]">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-100 px-3.5 py-1 text-xs font-medium tracking-wide text-zinc-700">
            <Scale className="h-3.5 w-3.5 text-zinc-900" />
            <span>State Jurisdiction Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A] leading-[1.08]">
            Pre-configured statutory form rules
          </h2>
          <p className="text-sm text-[#52525B] leading-relaxed">
            Select a state to review standardized inspection periods, loan approval windows, and daily cutoff standards.
          </p>
        </div>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 sm:p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          {/* State Pill Buttons */}
          <div className="flex flex-wrap gap-2.5">
            {STATE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedState(tmpl)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedState.id === tmpl.id
                    ? 'bg-[#0A0A0A] text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                {tmpl.code}
              </button>
            ))}
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block font-medium">
                Inspection Window
              </span>
              <span className="text-sm font-bold text-[#0A0A0A] font-mono mt-0.5 block">
                {selectedState.inspection}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block font-medium">
                Financing Contingency
              </span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
                {selectedState.financing}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block font-medium">
                Daily Cutoff Standard
              </span>
              <span className="text-sm font-bold text-[#0A0A0A] font-mono mt-0.5 block">
                {selectedState.cutoff}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-600 italic">
            Note: {selectedState.rule}
          </div>
        </div>
      </section>

      {/* ── 9. Brokerage Testimonials & Industry Validation ── */}
      <BrokerageTestimonials />

      {/* ── 10. Minimalist High-Converting Call To Action ── */}
      <section className="max-w-5xl mx-auto px-6 pb-28">
        <div className="rounded-3xl border border-[#E5E7EB] bg-[#FAF9F6] p-10 sm:p-14 text-center space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden">
          <div className="space-y-3 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A] leading-[1.08]">
              Ready to protect your escrow pipeline?
            </h2>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Empower your transaction coordinators and agents with automated contingency surveillance. Ingest your first contract in under 30 seconds.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? '/deals' : '/signup'}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 text-xs font-semibold rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-all hover:-translate-y-0.5 shadow-sm"
            >
              <span>{user ? 'Open Brokerage Workspace' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-[11px] text-zinc-400 font-sans">
            No credit card required &bull; SOC2 Type II Certified &bull; 100% E&amp;O Audit Ready
          </p>
        </div>
      </section>

      {/* ── 11. Minimalist Corporate Footer ── */}
      <footer className="border-t border-[#E5E7EB] py-12 px-6 sm:px-8 text-xs text-[#52525B] bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img
              src="/brand/eigen-estate-full.png"
              alt="EigenEstate"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[11px] text-zinc-400 sm:border-l sm:border-zinc-200 sm:pl-3">
              Autonomous Real Estate OS &amp; Closing Suite &copy; {new Date().getFullYear()} &bull; eigenestate.com
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <Link to="/contracts" className="hover:text-[#0A0A0A] transition-colors">
              State Rules
            </Link>
            <Link to="/pricing" className="hover:text-[#0A0A0A] transition-colors">
              Pricing
            </Link>
            <Link to="/security" className="hover:text-[#0A0A0A] transition-colors">
              Security &amp; E&amp;O
            </Link>
            <Link to="/docs" className="hover:text-[#0A0A0A] transition-colors">
              Documentation
            </Link>
            <Link to="/deals" className="hover:text-[#0A0A0A] transition-colors">
              Portfolio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
