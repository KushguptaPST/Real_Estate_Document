import { useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const Hero3DCanvas = lazy(() => import('@/components/landing/Hero3DCanvas').then((m) => ({ default: m.Hero3DCanvas })));
import { HeroDualTerminal } from '@/components/landing/HeroDualTerminal';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { PublicHeader } from '@/components/landing/PublicHeader';
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

const METRICS = [
  { value: '< 45s', label: 'Instant Lead Reply', sub: 'WhatsApp & Telegram' },
  { value: '$420M+', numeric: 420, label: 'Deposits Protected', sub: 'Across 12,000+ Closings' },
  { value: '99.98%', label: 'Deadline Accuracy', sub: 'State Contract Rules' },
  { value: '100%', label: 'Audit-Ready History', sub: 'Every Action Recorded' },
];

export function LandingPage() {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  // ── GSAP Master Timeline & Scroll Choreography ──────────────────────────
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
      <section className="relative flex flex-col justify-center items-center px-4 sm:px-6 pt-24 sm:pt-28 pb-16 text-center overflow-hidden">
        {/* Subtle, High-FPS Three.js Glass Geometry (lazy loaded) */}
        <Suspense fallback={null}>
          <Hero3DCanvas />
        </Suspense>

        <div className="relative z-10 max-w-5xl mx-auto space-y-6">
          {/* Eyebrow Badge */}
          <div className="gsap-hero-eyebrow inline-flex items-center rounded-full border border-zinc-200/90 bg-zinc-100 px-4 py-1.5 text-sm font-medium tracking-wide text-zinc-800">
            <span>24/7 AI Lead Assistant &bull; Automated Tour Booking &bull; Closing Deadline Tracker</span>
          </div>

          {/* Authoritative Display Heading */}
          <h1 className="gsap-hero-title text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.035em] text-[#0A0A0A] leading-[1.08] max-w-4xl mx-auto">
            Reply to every buyer. Close every deal.{' '}
            <span className="text-[#047857] block sm:inline">
              Never miss a deadline.
            </span>
          </h1>

          {/* Scannable Enterprise Body Copy */}
          <p className="gsap-hero-desc text-lg sm:text-xl text-[#52525B] max-w-[58ch] mx-auto leading-relaxed font-normal">
            Answer buyer questions in seconds, send property brochures, and book site visits automatically — while keeping every inspection, loan, and closing date on track.
          </p>

          {/* Interactive Hero CTAs */}
          <div className="gsap-hero-actions flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              to={user ? '/deals' : '/signup'}
              className="inline-flex items-center justify-center gap-2 h-12 px-7 text-sm font-semibold rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-colors hover:-translate-y-0.5 shadow-sm cursor-pointer"
            >
              <span>{user ? 'Open My Workspace' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {!user && (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-sm font-semibold rounded-full border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-colors hover:-translate-y-0.5 shadow-2xs"
              >
                <span>Sign In</span>
              </Link>
            )}

            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 text-sm font-semibold rounded-full border border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              <span>See How It Works</span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-[#52525B] border-t border-[#E5E7EB]/80 max-w-3xl mx-auto font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Replies in Under 60 Seconds
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Instant Brochure &amp; Tour Booking
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Automatic Deadline Reminders
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Complete Team Activity Log
            </span>
          </div>

          {/* ── Interactive Dual-Superpower Terminal (Sales + Escrow) ── */}
          <div className="pt-4 w-full">
            <HeroDualTerminal />
          </div>
        </div>
      </section>

      {/* ── 3. Brokerage Trust Marquee (GSAP Infinite Ticker) ── */}
      <section className="border-y border-[#E5E7EB] bg-[#FAF9F6] py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center">
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 font-semibold px-6 shrink-0 hidden sm:inline">
            PROTECTING TRANSACTIONS AT:
          </span>
          <div className="overflow-hidden flex-1 relative">
            <div ref={marqueeRef} className="flex gap-14 whitespace-nowrap will-change-transform">
              {[...TRUSTED_BROKERAGES, ...TRUSTED_BROKERAGES].map((name, i) => (
                <span
                  key={i}
                  className="text-sm font-semibold font-mono tracking-wider text-zinc-500 hover:text-zinc-800 transition-colors cursor-default"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Key Financial & Legal Metrics (GSAP Scrubbed) ── */}
      <section className="bg-white py-14 px-6 border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {METRICS.map((m, i) => (
            <div key={i} className="space-y-1.5">
              <div
                data-numeric={m.numeric}
                className="gsap-metric-counter text-4xl sm:text-5xl font-bold text-[#0A0A0A] tracking-tight font-mono"
              >
                {m.value}
              </div>
              <div className="text-sm font-bold text-[#0A0A0A] font-sans">{m.label}</div>
              <div className="text-xs text-[#71717A] font-sans">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Minimalist Bento Grid Architecture ── */}
      <div id="features">
        <BentoFeatures />
      </div>

      {/* ── 6. Brokerage Testimonials & Industry Validation ── */}
      <BrokerageTestimonials />

      {/* ── 7. Minimalist High-Converting Call To Action ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-[#E5E7EB] bg-[#FAF9F6] p-10 sm:p-14 text-center space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden">
          <div className="space-y-3 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A] leading-[1.1]">
              Ready to close deals faster without missing a date?
            </h2>
            <p className="text-base sm:text-lg text-[#52525B] leading-relaxed">
              Let your team focus on clients while Eigen Estate handles instant buyer replies, property tours, and contract deadline reminders.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? '/deals' : '/signup'}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-colors hover:-translate-y-0.5 shadow-sm"
            >
              <span>{user ? 'Open My Workspace' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-sm text-zinc-500 font-sans">
            No credit card required &bull; Set up in under 2 minutes &bull; Full team audit log included
          </p>
        </div>
      </section>

      {/* ── 8. Minimalist Corporate Footer ── */}
      <footer className="border-t border-[#E5E7EB] py-10 px-6 sm:px-8 text-sm text-[#52525B] bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img
              src="/brand/eigen-estate-full.png"
              alt="EigenEstate"
              className="h-7 w-auto object-contain"
            />
            <span className="text-xs text-zinc-500 sm:border-l sm:border-zinc-200 sm:pl-3">
              Autonomous Real Estate OS &amp; Closing Suite &copy; {new Date().getFullYear()} &bull; eigenestate.com
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
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
