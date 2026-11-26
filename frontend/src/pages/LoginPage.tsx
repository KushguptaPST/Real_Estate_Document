import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Lock,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { EigenEstateIcon } from '@/components/brand/EigenEstateLogo';

export function LoginPage() {
  const { signInWithGoogle, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite') || searchParams.get('invitation') || undefined;
  const from = (location.state as { from?: string } | null)?.from ?? '/deals';

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    const res = await signInWithGoogle(credential, inviteToken);
    if (res.isNewWorkspace || res.user.subscriptionStatus === 'PENDING_PAYMENT') {
      navigate('/signup', { replace: true });
      return;
    }
    navigate(from, { replace: true });
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    try {
      setPasswordLoading(true);
      setError(null);
      await loginWithPassword(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const highlights = [
    {
      icon: PhoneCall,
      title: 'ElevenLabs Flash v2.5 + Plivo AI Calling',
      desc: 'Sub-second voice qualification with live warm transfer to your assigned property advisor.',
    },
    {
      icon: MessageSquare,
      title: 'WhatsApp Speed-to-Lead & Coexistence',
      desc: 'AI replies 24/7 with brochures & map pins and pauses automatically when an advisor replies on mobile.',
    },
    {
      icon: FileSearch,
      title: 'Agreement & Contingency Intelligence',
      desc: 'Extracts binding deadlines from purchase PDFs with page-level citation verification and SMTP alerts.',
    },
  ];

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#FAF9F6] text-[#0A0A0A] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Left Brand & Architecture Showcase Panel ── */}
      <aside className="hidden lg:flex lg:col-span-5 xl:col-span-5 relative flex-col justify-between bg-[#0B0F14] text-white p-10 xl:p-12 overflow-hidden">
        {/* Ambient Radial Depth + Micro Grid */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-700/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
              <EigenEstateIcon className="h-5 w-5" fill="#34D399" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">EigenEstate</span>
              <span className="block text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">
                Real Estate OS
              </span>
            </div>
          </Link>
        </div>

        {/* Hero Copy & Capabilities */}
        <div className="relative z-10 space-y-8 my-auto py-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Voice, WhatsApp &amp; Closing Suite</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight leading-[1.15] text-white">
              One intelligent workspace for every buyer conversation and closing deadline.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Built for Indian brokerages and mandate teams to capture leads instantaneously and never miss a contractual milestone.
            </p>
          </div>

          <div className="space-y-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10"
                >
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Live Status Strip */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tenant-Isolated Workspaces</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Eigen Estate</span>
        </div>
      </aside>

      {/* ── Right Authentication Surface ── */}
      <div className="lg:col-span-7 xl:col-span-7 relative flex flex-col justify-between px-4 sm:px-10 py-5 sm:py-6 min-w-0">
        {/* Top Utility Navigation */}
        <header className="w-full max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 lg:hidden shrink-0">
            <img
              src="/brand/eigen-estate-full.png"
              alt="EigenEstate"
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </Link>
          <Link
            to="/"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 px-3 py-1.5 rounded-full hover:bg-zinc-200/50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium text-zinc-500">
            <Link to="/pricing" className="hover:text-zinc-950 transition-colors">Pricing</Link>
            <Link to="/security" className="hover:text-zinc-950 transition-colors">Security</Link>
            <Link to="/docs" className="hover:text-zinc-950 transition-colors">Docs</Link>
          </div>
        </header>

        {/* Centered Sign-In Card */}
        <main className="flex-1 flex flex-col items-center justify-center py-6 sm:py-10 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[430px]"
          >
            <div className="rounded-2xl sm:rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-9 shadow-[0_24px_60px_rgba(15,23,42,0.06),0_2px_6px_rgba(15,23,42,0.03)] space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                  <Lock className="h-3 w-3 text-emerald-700" />
                  <span>{inviteToken ? 'Team Workspace Invitation' : 'Workspace Sign-In'}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                  {inviteToken ? 'Join your brokerage team' : 'Sign in to EigenEstate'}
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {inviteToken
                    ? 'Continue with your invited Google email address to activate your advisor seat.'
                    : 'Use your verified Google account to access your brokerage pipeline, deals, and AI channels.'}
                </p>
              </div>

              {inviteToken && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950">
                  <UserCheck className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
                  <div>
                    <p className="font-semibold">Invitation Token Attached</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Sign in with the Google account where you received the invite email.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <GoogleSignInButton
                  onCredential={handleGoogleCredential}
                  onError={setError}
                  text="continue_with"
                />

                {/* Email / Password Toggle */}
                <div className="pt-1">
                  {!showPasswordForm ? (
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(true)}
                      className="w-full text-center text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1 cursor-pointer"
                    >
                      Sign in with email and password instead →
                    </button>
                  ) : (
                    <form onSubmit={handlePasswordSignIn} className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="agent@brokerage.com"
                          required
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {passwordLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>Sign In</span>
                      </button>
                    </form>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 font-medium text-center">
                    {error}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Passwordless Google OAuth 2.0 authentication</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Strict organization &amp; advisor role scoping</span>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">Setting up a new brokerage?</p>
                  <p className="text-[11px] text-slate-500">Pick a plan &amp; launch in minutes.</p>
                </div>
                <Link
                  to="/signup"
                  className="w-full sm:w-auto text-center shrink-0 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  Get Started →
                </Link>
              </div>
            </div>

            {/* Compact Platform Capabilities Card for Mobile & Tablet (< lg) */}
            <div className="lg:hidden mt-5 rounded-2xl bg-[#0B0F14] text-white p-5 space-y-3 border border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Autonomous Real Estate OS
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] p-2.5 border border-white/10">
                      <Icon className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-medium text-slate-200 leading-snug">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </main>

        {/* Minimal Footer */}
        <footer className="w-full max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 pt-2">
          <span>Google Verified Identity &bull; Full Audit Trail</span>
          <Link to="/" className="lg:hidden hover:text-zinc-700 font-medium">
            ← Home
          </Link>
        </footer>
      </div>
    </div>
  );
}
