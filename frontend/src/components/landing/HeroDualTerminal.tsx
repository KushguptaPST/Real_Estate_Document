import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  ShieldCheck,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Headphones,
  ArrowRight,
  UserCheck,
  Calendar,
  Send,
  Building2,
  Lock,
  PhoneCall,
  Volume2,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const WAVEFORM_BARS = [
  35, 60, 45, 80, 55, 95, 70, 40, 85, 100,
  65, 50, 75, 90, 60, 45, 80, 100, 75, 50,
  85, 60, 40, 75, 90, 65, 50, 70, 40, 55,
];

export function HeroDualTerminal() {
  const [activeTab, setActiveTab] = useState<'sales' | 'escrow'>('sales');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [humanTakeoverActive, setHumanTakeoverActive] = useState(false);

  // Simulated Voice Note Playback Loop
  useEffect(() => {
    let interval: any;
    if (isPlayingVoice) {
      interval = setInterval(() => {
        setVoiceProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingVoice(false);
            return 0;
          }
          return prev + 2.5 * playbackSpeed;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isPlayingVoice, playbackSpeed]);

  const toggleVoicePlayback = () => {
    if (isPlayingVoice) {
      setIsPlayingVoice(false);
    } else {
      if (voiceProgress >= 100) setVoiceProgress(0);
      setIsPlayingVoice(true);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_25px_70px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden text-left">
      {/* ── Top Window Bar with Segmented Superpower Switcher ── */}
      <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-3">
        {/* macOS Traffic Lights + Active Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-zinc-300" />
            <span className="h-3 w-3 rounded-full bg-zinc-300" />
            <span className="h-3 w-3 rounded-full bg-zinc-300" />
          </div>
          <span className="text-[11px] font-mono text-zinc-400 font-medium hidden sm:inline">
            Eigen Estate (eigenestate.com) &bull; Unified Real Estate OS
          </span>
        </div>

        {/* Dual Superpower Segmented Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-200/60 border border-zinc-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sales'
                ? 'bg-white text-[#0A0A0A] shadow-2xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
            <span>01. Inbound Sales Copilot</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('escrow')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'escrow'
                ? 'bg-white text-[#0A0A0A] shadow-2xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>02. Escrow Surveillance</span>
          </button>
        </div>

        {/* Live Engine Status Indicator */}
        <div className="hidden md:flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[10px] font-mono font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            AUTONOMOUS RUNTIME ACTIVE
          </span>
        </div>
      </div>

      {/* ── Terminal Body ── */}
      <div className="p-6 sm:p-8 bg-white min-h-[420px]">
        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════════════════════════════
              MODE 1: FRONT-OFFICE AI SALES COPILOT & VOICE NOTES
             ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'sales' && (
            <motion.div
              key="sales-terminal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column (7 Cols): Live Omnichannel Chat with Voice Memo */}
              <div className="lg:col-span-7 space-y-4">
                {/* Channel Header Pill */}
                <div className="flex items-center justify-between text-xs border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      LC
                    </span>
                    <div>
                      <div className="font-bold text-zinc-900 text-xs">Liam Chen</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Inbound Lead &bull; Speed-to-lead: 38s &bull; WhatsApp + Telegram
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Lead Score: 94/100 (HIGH INTENT)
                  </span>
                </div>

                {/* Customer Inquiry Bubble */}
                <div className="flex flex-col items-start space-y-1">
                  <span className="text-[10px] text-zinc-400 font-mono pl-1">Liam &bull; 10:42 AM</span>
                  <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[#F4F4F5] text-zinc-800 text-xs leading-relaxed max-w-[85%] border border-zinc-200/80">
                    &ldquo;Hey! We saw 1420 Ocean Ave. Looking for a 3-bed in Bellevue around $1.3M with great schools. Any chance we can walk the property this Saturday morning?&rdquo;
                  </div>
                </div>

                {/* AI Sales Copilot Response with PLAYABLE VOICE NOTE */}
                <div className="flex flex-col items-end space-y-1.5 pt-1">
                  <span className="text-[10px] text-emerald-700 font-mono pr-1 font-semibold flex items-center gap-1">
                    <Headphones className="h-3 w-3 text-emerald-600" />
                    AI Advisory Partner &bull; Neural Voice Note Delivered
                  </span>

                  {/* Playable WhatsApp Style Voice Note Card */}
                  <div className="w-full max-w-[90%] p-4 rounded-2xl rounded-tr-sm bg-emerald-50/60 border border-emerald-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
                          AI
                        </div>
                        <span className="text-xs font-bold text-emerald-950 font-sans">
                          Voice Memo (Spoken by Advisor Digital Twin)
                        </span>
                      </div>

                      {/* Speed Control Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setPlaybackSpeed((prev) =>
                            prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1
                          )
                        }
                        className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[10px] font-mono font-bold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        {playbackSpeed}x Speed
                      </button>
                    </div>

                    {/* Interactive Audio Waveform Player */}
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-emerald-200/80">
                      <button
                        type="button"
                        onClick={toggleVoicePlayback}
                        className="h-9 w-9 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center hover:bg-zinc-800 transition-transform active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                        aria-label="Play voice note preview"
                      >
                        {isPlayingVoice ? (
                          <Pause className="h-4 w-4 fill-white" />
                        ) : (
                          <Play className="h-4 w-4 fill-white ml-0.5" />
                        )}
                      </button>

                      {/* Waveform Bar Graphic with Active Playhead */}
                      <div className="flex items-center gap-1 flex-1 h-8 overflow-hidden">
                        {WAVEFORM_BARS.map((height, i) => {
                          const barProgress = (i / WAVEFORM_BARS.length) * 100;
                          const isPlayed = barProgress <= voiceProgress;
                          return (
                            <div
                              key={i}
                              className={`w-1 rounded-full transition-all duration-150 ${
                                isPlayed
                                  ? 'bg-emerald-600'
                                  : 'bg-zinc-200 hover:bg-zinc-300'
                              }`}
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>

                      <span className="text-[11px] font-mono text-zinc-500 font-semibold shrink-0">
                        0:18
                      </span>
                    </div>

                    {/* Verbatim Transcript Excerpt */}
                    <p className="text-[11px] text-emerald-900 italic font-serif leading-relaxed">
                      &ldquo;Hey Liam, Rahul here! 1420 Ocean just went under contract, but an off-market 3-bed in Bellevue literally opened up this morning at $1.28M. Walkable to Cherry Crest Elementary. I’ve penciled in Saturday at 11:00 AM for us to walk it.&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column (5 Cols): Structured Memory, Showing Booking & Governance */}
              <div className="lg:col-span-5 space-y-4">
                {/* 1. Fact-Provenance Memory Model Card */}
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E5E7EB] space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-200 pb-1.5">
                    <span>Fact-Provenance Memory</span>
                    <span className="text-emerald-700 font-bold">Auto-Structured</span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between">
                      <span className="text-zinc-500">Stated Budget:</span>
                      <strong className="text-zinc-900">$1,200,000 &ndash; $1,350,000</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between">
                      <span className="text-zinc-500">Target Area:</span>
                      <strong className="text-zinc-900">Bellevue (Cherry Crest)</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between">
                      <span className="text-zinc-500">Configuration:</span>
                      <strong className="text-zinc-900">3 Beds &bull; 2+ Baths</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Confirmed Showing Booking Card */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-900 font-bold font-sans">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-emerald-700" />
                      In-Person Tour Confirmed
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Zero Conflict
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                    <strong>Saturday, Nov 01 &bull; 11:00 AM PST</strong>
                    <br />
                    <span>Location: 1042 108th Ave NE, Bellevue, WA</span>
                  </p>

                  <div className="pt-1 text-[10px] text-emerald-800 font-mono flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>WhatsApp location pin &amp; floor plans dispatched</span>
                  </div>
                </div>

                {/* 3. Human Governance & 1-Click Takeover Toggle */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-zinc-700" />
                      <span>{humanTakeoverActive ? 'Human Advisor Live' : 'Autopilot Mode'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {humanTakeoverActive ? 'AI paused &bull; Advisor has mic' : 'AI responds in <60 seconds'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHumanTakeoverActive(!humanTakeoverActive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      humanTakeoverActive
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {humanTakeoverActive ? 'Resume AI' : 'Take Over'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              MODE 2: BACK-OFFICE STATUTORY ESCROW & DEADLINE SURVEILLANCE
             ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'escrow' && (
            <motion.div
              key="escrow-terminal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column (7 Cols): Active Deal Escrow Countdown & Verbatim Citation */}
              <div className="lg:col-span-7 space-y-4">
                {/* Deal Header */}
                <div className="flex items-center justify-between text-xs border-b border-zinc-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold block">
                      Active Escrow Surveillance
                    </span>
                    <h4 className="text-sm font-bold text-zinc-900 font-sans">
                      742 Evergreen Terrace &bull; Escrow #88219
                    </h4>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    $45,000 EMD Secured
                  </span>
                </div>

                {/* Statutory Countdown Banner */}
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-500 uppercase text-[10px]">Form 35 Inspection Cutoff</span>
                    <span className="text-emerald-700 font-bold">Monday, Nov 04 at 9:00 PM PST</span>
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 font-mono flex items-center gap-2.5">
                    <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>3 Days, 08 Hours, 12 Minutes Left</span>
                  </div>
                </div>

                {/* Verbatim Signed PDF Citation Box */}
                <div className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-2.5 font-mono text-xs shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-bold border-b border-zinc-100 pb-1.5">
                    <span>Verbatim Line Citation Anchor</span>
                    <span className="text-emerald-700 font-bold">Coordinates Verified</span>
                  </div>

                  <div className="space-y-1 font-mono text-[11px] leading-relaxed text-zinc-600 bg-[#FAF9F6] p-3 rounded-xl border border-zinc-200">
                    <div className="text-zinc-400 text-[10px]">Page 4, Line 17: ...upon mutual acceptance of this contract...</div>
                    <div className="bg-emerald-50 text-emerald-950 font-semibold px-2 py-1 rounded border border-emerald-200">
                      Line 18: Buyer shall have 10 calendar days to complete inspections...
                    </div>
                    <div className="text-zinc-400 text-[10px]">Page 4, Line 19: ...and deliver written notice prior to 9:00 PM cutoff...</div>
                  </div>

                  <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                    <span>Anchor: [X: 142.5, Y: 388.2, Pg: 4]</span>
                    <strong className="text-zinc-800">NWMLS Form 35 §4.2</strong>
                  </div>
                </div>
              </div>

              {/* Right Column (5 Cols): Deterministic Date Math & Automated Outbox */}
              <div className="lg:col-span-5 space-y-4">
                {/* 1. Deterministic Rollover Pipeline */}
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E5E7EB] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-200 pb-1.5">
                    <span>Jurisdiction Date Engine</span>
                    <span className="text-emerald-700 font-bold">Zero Hallucinations</span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between">
                      <span className="text-zinc-500">Mutual Date:</span>
                      <strong className="text-zinc-900">Friday, Oct 24, 2026</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-red-900">
                      <span className="text-red-700">Raw Day 10 (Trap):</span>
                      <strong className="font-bold">Sunday, Nov 03</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-950">
                      <span className="text-emerald-800">Rolled Forward:</span>
                      <strong className="font-bold">Mon, Nov 04 &bull; 9 PM PST</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Transactional Outbox Automated Alerts */}
                <div className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 uppercase font-bold border-b border-zinc-100 pb-1.5">
                    <span>Multi-Party Delivery Queue</span>
                    <span className="text-emerald-700 font-bold">Idempotent</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-zinc-50 border border-zinc-200/80">
                      <span className="font-medium text-zinc-900">First American Title &bull; Escrow</span>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">T-3 Dispatched</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-zinc-50 border border-zinc-200/80">
                      <span className="font-medium text-zinc-900">Wells Fargo &bull; Mortgage Officer</span>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">T-1 Queued</span>
                    </div>
                  </div>
                </div>

                {/* 3. E&O Hash Cryptographic Audit */}
                <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-800 font-semibold text-[11px]">
                    <Lock className="h-3.5 w-3.5 text-emerald-600" />
                    <span>E&amp;O Hash:</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate max-w-[210px]">
                    SHA256: 7f83b165...e464
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Action Strip ── */}
      <div className="px-6 py-3.5 bg-[#FAF9F6] border-t border-[#E5E7EB] flex flex-wrap items-center justify-between text-xs text-zinc-500">
        <span className="font-mono text-[11px]">
          One unified database record from first lead inquiry to final escrow closing.
        </span>
        <Link
          to="/signup"
          className="inline-flex items-center gap-1.5 font-bold text-zinc-900 hover:text-emerald-700 transition-colors"
        >
          <span>Test Platform Live</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

