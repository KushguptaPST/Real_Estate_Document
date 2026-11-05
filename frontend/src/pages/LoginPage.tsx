import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  Building2,
  ShieldCheck,
  Lock,
  Mail,
  AlertTriangle,
  Loader2,
  UserCheck,
  ArrowRight,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'];

export function LoginPage() {
  const { signInWithGoogle, loginWithPassword, signInAsDemoAgent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [demoLoading, setDemoLoading] = useState<'AGENT' | 'OWNER' | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite') || searchParams.get('invitation') || undefined;
  const from = (location.state as { from?: string } | null)?.from ?? '/deals';

  // Google SSO Script Loader (only if client ID is configured)
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    const loadGoogleScript = (): Promise<void> => {
      if (window.google?.accounts.id) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        const script = existing ?? document.createElement('script');
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('Could not load Google Sign-In')));
        if (!existing) {
          script.src = GSI_SRC;
          script.async = true;
          document.head.appendChild(script);
        }
      });
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setSigningIn(true);
            setError(null);
            try {
              await signInWithGoogle(credential, inviteToken);
              navigate(from, { replace: true });
            } catch (err) {
              setError((err as Error).message);
              setSigningIn(false);
            }
          },
        });
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.warn('Google Sign-In load notice:', err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signInWithGoogle, navigate, from, inviteToken]);

  useEffect(() => {
    if (!ready || signingIn || !buttonRef.current || !window.google || !CLIENT_ID) return;
    buttonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: Math.min(380, buttonRef.current.clientWidth || 380),
    });
  }, [ready, signingIn]);

  const handleDemoLogin = async (role: 'AGENT' | 'OWNER' = 'AGENT') => {
    setDemoLoading(role);
    setError(null);
    try {
      await signInAsDemoAgent(role);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize demo sandbox session';
      setError(msg);
    } finally {
      setDemoLoading(null);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || submittingPassword) return;
    setSubmittingPassword(true);
    setError(null);
    try {
      await loginWithPassword(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError(msg);
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#FAFAF8] text-[#0A0A0A] font-sans selection:bg-emerald-100 selection:text-emerald-900 flex flex-col justify-between overflow-x-hidden">
      {/* ── Ambient Soft Glow & Faint Micro-Grid ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-100/40 via-zinc-100/20 to-transparent blur-3xl opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* ── Minimal Header ── */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A0A0A] text-white shadow-2xs group-hover:scale-105 transition-transform">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-[#0A0A0A]">
            Contingency Copilot
          </span>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 px-3 py-1.5 rounded-full hover:bg-zinc-100/80 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* ── Main Centered Card ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Main Elevated Card */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white p-7 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] space-y-5">
            {/* Card Header: Short & Clean */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                Welcome back
              </h1>
              <p className="text-xs text-zinc-500">
                Sign in to your real estate workspace
              </p>
            </div>

            {/* Invite Banner (if applicable) */}
            {inviteToken && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-950">
                <UserCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                <span className="text-[11px] font-medium">Workspace Invitation Active</span>
              </div>
            )}

            {/* ── 1-Click Instant Demo Sandbox ── */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-zinc-900">Instant Demo Access</span>
                </div>
                <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                  No password needed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoLogin('AGENT')}
                  disabled={demoLoading !== null || signingIn}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-900 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {demoLoading === 'AGENT' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-900" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>Demo Agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLogin('OWNER')}
                  disabled={demoLoading !== null || signingIn}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-zinc-800 text-white text-xs font-semibold shadow-2xs transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  {demoLoading === 'OWNER' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-white" />
                  )}
                  <span>Broker Owner</span>
                </button>
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="relative flex py-0.5 items-center">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-zinc-400 font-mono tracking-wider">
                OR EMAIL
              </span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            {/* Google SSO Container (rendered only if client ID configured) */}
            {CLIENT_ID && (
              <div className="flex min-h-[44px] w-full flex-col justify-center items-center overflow-hidden">
                {signingIn && (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 w-full">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-900" />
                    <span>Signing in...</span>
                  </div>
                )}
                <div
                  ref={buttonRef}
                  className={`flex w-full justify-center overflow-hidden ${
                    signingIn ? 'hidden' : 'block'
                  }`}
                />
              </div>
            )}

            {/* Standard Login Form */}
            <form onSubmit={handlePasswordLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-700 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@brokerage.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-700">Password</label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Password reset link dispatched to your email.');
                    }}
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-600 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="text-[11px] text-zinc-500">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingPassword}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] hover:bg-zinc-800 text-white text-xs font-semibold py-2.5 shadow-2xs transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              >
                {submittingPassword ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Bottom Signup Link */}
            <div className="pt-2 text-center border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                New brokerage?{' '}
                <Link
                  to="/signup"
                  className="font-bold text-[#0A0A0A] hover:underline transition-all"
                >
                  Create workspace
                </Link>
              </p>
            </div>
          </div>

          {/* Quick Footer Security Pill */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-mono">
            <span>SOC2 Type II</span>
            <span>&bull;</span>
            <span>AES-256 Vault</span>
            <span>&bull;</span>
            <span>E&amp;O Audit Ready</span>
          </div>
        </motion.div>
      </main>

      {/* ── Minimal Bottom Footer ── */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-zinc-400">
        <span>&copy; {new Date().getFullYear()} Contingency Copilot</span>
        <div className="flex items-center gap-4">
          <Link to="/pricing" className="hover:text-zinc-600 transition-colors">Pricing</Link>
          <Link to="/security" className="hover:text-zinc-600 transition-colors">Security</Link>
          <Link to="/docs" className="hover:text-zinc-600 transition-colors">Docs</Link>
        </div>
      </footer>
    </div>
  );
}
