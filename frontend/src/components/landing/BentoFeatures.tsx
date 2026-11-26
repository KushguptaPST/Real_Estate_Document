import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneCall,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  Lock,
  Volume2,
  Play,
  Pause,
  MessageSquare,
  Building2,
  FileText,
  Mail,
  Zap,
  Check,
  Scale,
  Eye,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const WAVEFORM_BARS = [
  30, 45, 60, 25, 70, 85, 40, 55, 90, 65,
  45, 80, 100, 75, 50, 85, 60, 40, 75, 90,
  65, 50, 70, 40, 55, 35, 45, 30,
];

const STATE_CUTOFF_STANDARDS = [
  {
    state: 'Washington (NWMLS)',
    form: 'Form 35 §4.2',
    cutoff: '9:00 PM PST',
    rule: 'Sundays & legal holidays roll forward to the next business day at 9:00 PM.',
  },
  {
    state: 'California (CAR RPA)',
    form: 'Paragraph 14B',
    cutoff: '11:59 PM PST',
    rule: 'Active Contingency Removal (CR) required. Does not expire passively.',
  },
  {
    state: 'Florida (FAR/BAR)',
    form: 'Standard F AS-IS',
    cutoff: '5:00 PM EST',
    rule: 'Banking holiday roll-forward at 5:00 PM local time.',
  },
  {
    state: 'Texas (TREC)',
    form: 'Paragraph 23 Option',
    cutoff: '5:00 PM CST',
    rule: 'Option period termination fee delivery deadline strictly enforced at 5:00 PM.',
  },
];

export function BentoFeatures() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(35);
  const [selectedCutoff, setSelectedCutoff] = useState(STATE_CUTOFF_STANDARDS[0]);
  const [governanceMode, setGovernanceMode] = useState<'autopilot' | 'draft' | 'takeover'>('autopilot');
  const [lensHovered, setLensHovered] = useState(false);

  return (
    <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-28 space-y-16">
      {/* ── Section Header ── */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-zinc-100 px-4 py-1.5 text-sm font-medium tracking-wide text-zinc-700">
          <Building2 className="h-4 w-4 text-zinc-900" />
          <span>Built for Real Estate Teams</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0A0A0A] leading-[1.1]">
          Everything you need from first inquiry to closing day.
        </h2>
        <p className="text-base sm:text-lg text-[#52525B] leading-relaxed max-w-[58ch] mx-auto">
          One simple workspace that replies to new buyers automatically and tracks every contract deadline for your team.
        </p>
      </div>

      {/* ── High-Craft Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* ── BENTO 1: Autonomous Voice Sales Agent & WhatsApp Waveform (Large 7 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-7 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <Volume2 className="h-3.5 w-3.5 text-zinc-900" />
                <span>24/7 Lead Assistant</span>
              </div>
              <span className="text-xs sm:text-sm text-emerald-700 font-bold bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
                Replies Under 60s
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Instant Buyer Replies &amp; Voice Messages
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Automatically replies to new buyer messages on Telegram and WhatsApp with property details, PDF brochures, and natural voice messages — even when your team is busy.
            </p>

            {/* Interactive Playable Voice Note Card */}
            <div className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm border-b border-zinc-200 pb-2">
                <span className="text-zinc-700 font-semibold">AI Assistant Voice Message</span>
                <span className="text-emerald-700 font-bold">Sent on WhatsApp &amp; Telegram</span>
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="h-10 w-10 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center hover:bg-zinc-800 transition-transform active:scale-95 cursor-pointer shrink-0"
                >
                  {isPlayingAudio ? (
                    <Pause className="h-4 w-4 fill-white" />
                  ) : (
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  )}
                </button>

                <div className="flex items-center gap-1 flex-1 h-8 overflow-hidden">
                  {WAVEFORM_BARS.map((height, i) => {
                    const played = i <= (audioProgress / 100) * WAVEFORM_BARS.length;
                    return (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          played ? 'bg-emerald-600' : 'bg-zinc-200'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>

                <span className="text-xs font-mono text-zinc-500 font-semibold shrink-0">
                  0:18
                </span>
              </div>

              <p className="text-sm text-zinc-800 italic leading-relaxed bg-white p-3.5 rounded-xl border border-zinc-200/70">
                &ldquo;Hey Liam, Rahul here! 1420 Ocean just went under contract, but a 3-bed in Bellevue opened up this morning at $1.28M. I’ve penciled in Saturday at 11:00 AM for us to tour it.&rdquo;
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-zinc-500">Matches properties &amp; sends brochures automatically</span>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>Try Assistant</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* ── BENTO 2: 3-Tier Human Governance & Takeover (5 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-5 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <UserCheck className="h-3.5 w-3.5 text-zinc-900" />
                <span>Team Control</span>
              </div>
              <span className="text-xs text-zinc-500 font-medium">You Stay in Charge</span>
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Step In Anytime With 1-Click Takeover
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Choose how much the AI handles: let it reply automatically, review drafts before they send, or take over the conversation yourself in one click.
            </p>

            {/* Interactive State Toggle */}
            <div className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-200/60">
                <button
                  type="button"
                  onClick={() => setGovernanceMode('autopilot')}
                  className={`py-2 rounded-lg text-center font-bold transition-all cursor-pointer text-xs ${
                    governanceMode === 'autopilot'
                      ? 'bg-white text-[#0A0A0A] shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Auto-Reply
                </button>
                <button
                  type="button"
                  onClick={() => setGovernanceMode('draft')}
                  className={`py-2 rounded-lg text-center font-bold transition-all cursor-pointer text-xs ${
                    governanceMode === 'draft'
                      ? 'bg-white text-[#0A0A0A] shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Review Drafts
                </button>
                <button
                  type="button"
                  onClick={() => setGovernanceMode('takeover')}
                  className={`py-2 rounded-lg text-center font-bold transition-all cursor-pointer text-xs ${
                    governanceMode === 'takeover'
                      ? 'bg-amber-100 text-amber-900 shadow-2xs border border-amber-300'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Human Only
                </button>
              </div>

              {/* State Explanation Box */}
              <div className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 text-sm font-sans">
                  {governanceMode === 'autopilot' && 'Auto-Reply Active'}
                  {governanceMode === 'draft' && 'Approval Queue'}
                  {governanceMode === 'takeover' && 'Agent in Control'}
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 font-sans leading-relaxed">
                  {governanceMode === 'autopilot' && 'Replies to buyers in under 60 seconds and books property tours automatically.'}
                  {governanceMode === 'draft' && 'Prepares suggested replies for your agent to approve before sending.'}
                  {governanceMode === 'takeover' && 'AI pauses immediately so your human agent can chat directly with the buyer.'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-zinc-500">Full control over every chat</span>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>Learn More</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* ── BENTO 3: Conflict-Free Showing & Site Visit Booking (5 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-5 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <Calendar className="h-3.5 w-3.5 text-zinc-900" />
                <span>Site Visits</span>
              </div>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Direct Booking
              </span>
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Automatic Property Tour Booking
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Checks your team’s free time slots, confirms in-person property tours with buyers, and sends them the address and map pin automatically.
            </p>

            {/* Showing Confirmation Preview Card */}
            <div className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <span className="font-bold text-zinc-900 text-xs">Confirmed Showing #842</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                    Saturday 11:00 AM
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-zinc-800">
                  1042 108th Ave NE &bull; Bellevue, WA
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Buyer: Liam Chen &bull; Broker: Sarah Jenkins
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-zinc-200 flex items-center justify-between text-[11px] shadow-2xs">
                <span className="flex items-center gap-1.5 text-zinc-800">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp Location Pin Dispatched</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">Synced</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">Syncs with Google Calendar &amp; Outlook</span>
            <Link
              to="/deals"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>Manage Showings</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* ── BENTO 4: Deterministic 50-State Statutory Calendar Engine (Large 7 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-7 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <Scale className="h-3.5 w-3.5 text-zinc-900" />
                <span>Closing Deadlines</span>
              </div>
              <span className="text-xs sm:text-sm text-emerald-700 font-bold bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
                50-State Rules
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Smart Contract &amp; Deadline Calendar
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Never calculate inspection or loan deadlines by hand. Automatically accounts for weekends, public holidays, and each state’s exact cutoff times.
            </p>

            {/* Visual Rollover Matrix */}
            <div className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono text-center">
                <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-2xs">
                  <span className="text-[10px] text-zinc-400 uppercase block font-medium">Step 1: Mutual Date</span>
                  <strong className="text-zinc-900 block mt-0.5">Fri, Oct 24</strong>
                  <span className="text-[10px] text-zinc-500 block">Offer Accepted</span>
                </div>

                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 shadow-2xs">
                  <span className="text-[10px] text-red-600 uppercase block font-semibold">Step 2: Day 10 (Trap)</span>
                  <strong className="block mt-0.5 font-bold">Sun, Nov 03</strong>
                  <span className="text-[10px] text-red-700 block">Weekend Rollover</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-2xs">
                  <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Step 3: Statutory Cutoff</span>
                  <strong className="block mt-0.5 font-bold">Mon, Nov 04 &bull; 9 PM</strong>
                  <span className="text-[10px] text-emerald-800 block">WA NWMLS Cutoff</span>
                </div>
              </div>

              {/* 4 State Cutoff Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs font-mono">
                {STATE_CUTOFF_STANDARDS.map((s) => (
                  <button
                    key={s.state}
                    type="button"
                    onClick={() => setSelectedCutoff(s)}
                    className={`p-2 rounded-xl transition-all cursor-pointer border ${
                      selectedCutoff.state === s.state
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-2xs'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-[9px] opacity-75 block uppercase">{s.state.split(' ')[0]}</span>
                    <strong className="text-[11px] block mt-0.5">{s.cutoff}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-zinc-500">Accurate dates &bull; Zero guesswork</span>
            <Link
              to="/contracts"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>View State Rules</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* ── BENTO 5: Verifiable PDF Line Citation Lens (6 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-6 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <Search className="h-3.5 w-3.5 text-zinc-900" />
                <span>Verified Answers</span>
              </div>
              <span className="text-xs text-zinc-500 font-medium">Direct PDF Highlight</span>
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Instant Proof From Your Signed PDF
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Every extracted deadline links straight back to the exact page and line in your uploaded purchase agreement so you can verify it in one click.
            </p>

            {/* Document Inspection Reticle Artifact */}
            <div
              onMouseEnter={() => setLensHovered(true)}
              onMouseLeave={() => setLensHovered(false)}
              className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 space-y-2.5 text-xs sm:text-sm cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-200 pb-1.5">
                <span>Contract Line Preview</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  Hover to Highlight
                </span>
              </div>

              <div className="space-y-1.5 text-xs leading-relaxed bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs">
                <div className="text-zinc-400">Page 4, Line 17: ...upon mutual acceptance of this contract...</div>
                <div
                  className={`px-2 py-1 rounded border transition-all ${
                    lensHovered
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium'
                  }`}
                >
                  Line 18: Buyer shall have 10 calendar days to complete inspections...
                </div>
                <div className="text-zinc-400">Page 4, Line 19: ...prior to 9:00 PM statutory cutoff...</div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-100 text-xs text-zinc-600 flex items-center justify-between">
                <span>Matched on Page 4, Line 18</span>
                <strong className="text-zinc-800">NWMLS Form 35</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-zinc-500">Easy to double-check any date</span>
            <Link
              to="/security"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>Security Details</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* ── BENTO 6: Activity History & Reminders (6 Cols) ── */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="md:col-span-6 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6 text-left"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs sm:text-sm font-medium border border-zinc-200/80">
                <Lock className="h-3.5 w-3.5 text-zinc-900" />
                <span>Compliance &amp; Safety</span>
              </div>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Audit Ready
              </span>
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-[#0A0A0A] leading-tight">
              Automatic Reminders &amp; Complete Activity Log
            </h3>

            <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
              Every deadline alert, date update, and client message is saved in a permanent timeline so your brokerage always has a clear paper trail.
            </p>

            {/* Audit Vault Preview */}
            <div className="rounded-2xl bg-[#FAF9F6] border border-zinc-200/90 p-4 space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-200 pb-2">
                <span>Deal Activity Timeline</span>
                <span className="text-emerald-700 font-bold">Verified Record</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-zinc-200 flex items-center justify-between shadow-2xs">
                  <span className="text-zinc-700 font-semibold">3-Day Inspection Reminder Sent</span>
                  <span className="text-emerald-700 font-bold">DELIVERED</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-xs truncate shadow-2xs">
                  Confirmed by Stork Rikle &bull; Nov 25, 2:14 PM
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Protects your brokerage during compliance checks &amp; closing reviews</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-zinc-500">Full history for every deal</span>
            <Link
              to="/security"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0A0A0A] hover:text-emerald-700 transition-colors group"
            >
              <span>View Audit Trail</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
