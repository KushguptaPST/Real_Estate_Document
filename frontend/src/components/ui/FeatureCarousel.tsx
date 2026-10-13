import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Calendar,
  Bell,
  Scale,
  ShieldCheck,
  Bot,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface FeatureItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  link: string;
  linkLabel: string;
}

export const CORE_FEATURES: FeatureItem[] = [
  {
    id: 'ingestion',
    title: 'AI Contract Ingestion',
    category: 'Document Intelligence',
    description:
      'Upload executed Purchase & Sale Agreements. Clauses, addenda, counter offers, and mutual acceptance dates are parsed in under 3 seconds.',
    icon: FileText,
    tag: 'Instant OCR & Parser',
    link: '/upload',
    linkLabel: 'Ingest Agreement',
  },
  {
    id: 'date-math',
    title: 'Deterministic Date Math',
    category: 'Legal Calendar Engine',
    description:
      'Automatically calculates contingency deadlines adjusting for federal holidays, Saturday/Sunday rules, and jurisdiction cutoff hours.',
    icon: Calendar,
    tag: 'Zero Date Errors',
    link: '/contracts',
    linkLabel: 'View State Rules',
  },
  {
    id: 'alerts',
    title: 'Automated Milestone Alerts',
    category: 'Delivery Orchestration',
    description:
      'Dispatches verified reminders to agents, buyers, sellers, and escrow officers via Resend at T-3, T-1, and 9:00 AM on deadline day.',
    icon: Bell,
    tag: 'Email & SMS Engine',
    link: '/pricing',
    linkLabel: 'Alert Windows',
  },
  {
    id: 'citations',
    title: 'Verifiable Page Citations',
    category: 'E&O Compliance Guard',
    description:
      'Anchors every extracted deadline directly to exact line numbers and page coordinates in your original PDF. Zero LLM hallucinations.',
    icon: Search,
    tag: '1-Click PDF Inspector',
    link: '/security',
    linkLabel: 'Inspect Security',
  },
  {
    id: 'state-rules',
    title: 'Multi-State Rules Engine',
    category: 'Statutory Compliance',
    description:
      'Pre-calibrated for NWMLS Form 21 (WA), CAR RPA (CA), FAR/BAR (FL), TREC (TX), and NYSAR (NY) standard real estate contracts.',
    icon: Scale,
    tag: '5 State Standards',
    link: '/contracts',
    linkLabel: 'Browse Standards',
  },
  {
    id: 'audit-trail',
    title: 'Immutable Audit Trail',
    category: 'Risk Mitigation',
    description:
      'Every date calculation, user override, and email dispatch is cryptographically logged for undisputed Errors & Omissions legal defense.',
    icon: ShieldCheck,
    tag: 'Tamper-Evident Logs',
    link: '/security',
    linkLabel: 'Compliance Defense',
  },
  {
    id: 'rag-copilot',
    title: 'AI Portfolio RAG Assistant',
    category: 'Contract Search',
    description:
      'Query your entire portfolio of active contracts and disclosures using natural language, with responses grounded in verified document text.',
    icon: Bot,
    tag: 'Tenant-Isolated Vectors',
    link: '/knowledge',
    linkLabel: 'Knowledge Copilot',
  },
  {
    id: 'lead-matching',
    title: 'Inbound Lead Matching',
    category: 'Brokerage CRM',
    description:
      'Parses cold inquiries from portals and websites, extracting budget, location, and bedroom preferences to match available inventory.',
    icon: Users,
    tag: 'Speed to Lead',
    link: '/leads',
    linkLabel: 'Lead Cockpit',
  },
];

export function FeatureCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = CORE_FEATURES.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-play timer (pauses when user hovers)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  };

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Calculate visible indices for circular carousel
  const getVisibleIndices = () => {
    return [
      (currentIndex - 1 + total) % total,
      currentIndex,
      (currentIndex + 1) % total,
    ];
  };

  const [leftIdx, centerIdx, rightIdx] = getVisibleIndices();

  return (
    <div
      className="relative select-none outline-none focus:outline-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Features Carousel"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Carousel Track ── */}
      <div className="relative overflow-hidden py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {/* Card 1: Left / Previous on Desktop */}
          <div className="hidden lg:block">
            <FeatureCard item={CORE_FEATURES[leftIdx]} isActive={false} onSelect={prevSlide} />
          </div>

          {/* Card 2: Center / Active Item */}
          <div className="w-full">
            <FeatureCard item={CORE_FEATURES[centerIdx]} isActive={true} />
          </div>

          {/* Card 3: Right / Next on Tablet & Desktop */}
          <div className="hidden md:block">
            <FeatureCard item={CORE_FEATURES[rightIdx]} isActive={false} onSelect={nextSlide} />
          </div>
        </div>
      </div>

      {/* ── Carousel Bottom Controls (Arrows + Dots) ── */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        {/* Slide Counter / Status */}
        <div className="text-xs font-mono text-[#9A9AA5] flex items-center gap-2">
          <span className="text-[#C9A961] font-bold">0{currentIndex + 1}</span>
          <span className="text-white/20">/</span>
          <span>0{total}</span>
          <span className="text-[11px] text-white/30 ml-2 hidden sm:inline">
            Use arrows or swipe to browse
          </span>
        </div>

        {/* Dot Indicators */}
        <div className="flex items-center gap-2">
          {CORE_FEATURES.map((feat, idx) => (
            <button
              key={feat.id}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}: ${feat.title}`}
              className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                idx === currentIndex
                  ? 'w-7 bg-[#C9A961] shadow-[0_0_10px_rgba(201,169,97,0.5)]'
                  : 'w-1.5 bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Navigation Arrow Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevSlide}
            aria-label="Previous feature"
            className="h-9 w-9 rounded-full border border-white/10 bg-[#141418] text-[#F5F5F7] hover:border-[#C9A961]/40 hover:text-[#C9A961] hover:bg-[#1A1A22] transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next feature"
            className="h-9 w-9 rounded-full border border-white/10 bg-[#141418] text-[#F5F5F7] hover:border-[#C9A961]/40 hover:text-[#C9A961] hover:bg-[#1A1A22] transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  item,
  isActive,
  onSelect,
}: {
  item: FeatureItem;
  isActive: boolean;
  onSelect?: () => void;
}) {
  const Icon = item.icon;

  return (
    <div
      onClick={onSelect}
      className={`h-full flex flex-col justify-between p-7 rounded-2xl transition-all duration-400 ease-out border ${
        isActive
          ? 'bg-gradient-to-b from-[#181820] to-[#121216] border-[#C9A961]/40 shadow-2xl scale-[1.01] ring-1 ring-[#C9A961]/20'
          : 'bg-[#121216]/60 border-white/6 opacity-75 hover:opacity-100 hover:border-white/15 cursor-pointer'
      }`}
    >
      <div>
        {/* Top Tag & Category */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30 shadow-[0_0_15px_rgba(201,169,97,0.2)]'
                  : 'bg-white/5 text-[#9A9AA5] border border-white/10'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#C9A961] block font-semibold">
                {item.category}
              </span>
              <span className="text-[11px] text-[#9A9AA5] font-medium block">
                {item.tag}
              </span>
            </div>
          </div>

          {isActive && (
            <span className="h-2 w-2 rounded-full bg-[#C9A961] animate-ping" />
          )}
        </div>

        {/* Feature Title */}
        <h3 className="text-lg font-bold text-[#F5F5F7] tracking-tight mb-2.5">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#9A9AA5] leading-relaxed font-normal">
          {item.description}
        </p>
      </div>

      {/* Action CTA Link */}
      <div className="pt-6 mt-6 border-t border-white/6 flex items-center justify-between">
        <Link
          to={item.link}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-all ${
            isActive
              ? 'text-[#C9A961] hover:text-[#DFBF77]'
              : 'text-[#9A9AA5] hover:text-[#F5F5F7]'
          }`}
        >
          <span>{item.linkLabel}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        <span className="text-[10px] text-white/20 font-mono">
          Ready to deploy
        </span>
      </div>
    </div>
  );
}
