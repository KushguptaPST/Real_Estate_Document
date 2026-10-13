import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api';
import {
  Building2,
  Sparkles,
  ShieldCheck,
  Clock,
  Lock,
  Mail,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Precision Clause Extraction',
    body: 'Upload any standard purchase agreement. Ingestion engine parses binding contingency clauses with verbatim page citations.',
  },
  {
    icon: Clock,
    title: 'Deterministic Deadline Math',
    body: 'Calendar & business-day calculation rules compute expiration timestamps with state jurisdiction awareness.',
  },
  {
    icon: Mail,
    title: 'Automated Brokerage Alerts',
    body: 'Multi-channel email & SMS reminders dispatched at T-3, T-1, and day-of expiration to protect earnest money deposits.',
  },
];

function loadGoogleScript(): Promise<void> {
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
}

export function LoginPage() {
  const { signInWithGoogle, signInAsDemoAgent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);
  const [error, setError] = useState<string | null>(
    CLIENT_ID ? null : 'VITE_GOOGLE_CLIENT_ID is not configured.',
  );
  const [signingIn, setSigningIn] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite') || searchParams.get('invitation') || undefined;

  const from = (location.state as { from?: string } | null)?.from ?? '/upload';

  useEffect(() => {
    authApi
      .getConfig()
      .then((cfg) => setDemoLoginEnabled(Boolean(cfg.demoLoginEnabled)))
      .catch(() => setDemoLoginEnabled(false));
  }, []);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

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
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [signInWithGoogle, navigate, from, inviteToken]);

  const handleDemoLogin = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInAsDemoAgent();
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!ready || signingIn || !buttonRef.current || !window.google) return;
    buttonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: Math.min(360, buttonRef.current.clientWidth || 360),
    });
  }, [ready, signingIn]);

  return (
    <div className="relative flex min-h-screen bg-[#0A0A0B] text-[#F5F5F7] overflow-hidden font-sans">
      {/* Subtle architectural atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[#C9A961]/5 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[450px] w-[450px] rounded-full bg-[#C9A961]/5 blur-3xl" />
      </div>

      {/* ── Brand Showcase Side Panel ───────────────────────────────────────── */}
      <aside className="relative hidden w-[48%] overflow-hidden bg-[#0D0D11] text-[#F5F5F7] lg:flex lg:flex-col lg:justify-between lg:p-14 border-r border-white/[0.08] backdrop-blur-2xl z-10">
        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#141418] text-[#C9A961] shadow-md border border-[#C9A961]/30 group-hover:border-[#C9A961]/60 transition-colors">
              <Building2 className="h-5 w-5 text-[#C9A961]" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">
                Contingency Copilot
              </span>
              <span className="text-[10px] text-[#9A9AA5]">
                Brokerage Escrow Suite
              </span>
            </div>
          </Link>
          <Badge variant="gold" className="text-[10px]">
            <ShieldCheck className="h-3 w-3 text-[#C9A961] mr-1" /> SOC2 Compliant
          </Badge>
        </div>

        <div className="relative max-w-lg space-y-7 my-auto py-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A961]/30 bg-[#C9A961]/10 px-3.5 py-1 text-xs font-semibold text-[#C9A961]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A961]" />
              <span>Zero-Hallucination Legal Extraction Engine</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
              Autonomous contingency surveillance for modern brokerage teams.
            </h2>
            <p className="text-sm leading-relaxed text-[#9A9AA5]">
              Transform unstructured purchase agreements into binding milestone timelines, automated multi-channel alerts, and citation-backed contract intelligence.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#141418] border border-white/[0.08] shadow-sm hover:border-[#C9A961]/30 transition-all">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-white/[0.08] mt-0.5">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[#F5F5F7]">{title}</h4>
                  <p className="text-xs text-[#9A9AA5] leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-[#6E6E7A] pt-6 border-t border-white/[0.08] font-mono">
          <span>AES-256 Document Vault</span>
          <span>E&amp;O Compliance Insured</span>
        </div>
      </aside>

      {/* ── Auth Form Center Box ────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 relative z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header */}
          <div className="flex flex-col items-center text-center lg:hidden mb-2">
            <Link to="/" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#141418] text-[#C9A961] shadow-xl border border-[#C9A961]/30 mb-2">
              <Building2 className="h-6 w-6 text-[#C9A961]" />
            </Link>
            <h2 className="text-xl font-bold text-white">Contingency Copilot</h2>
            <p className="text-xs text-[#9A9AA5] mt-0.5">Real Estate Transaction Compliance</p>
          </div>

          {/* Main Auth Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141418] p-8 shadow-2xl text-white space-y-6">
            <div className="space-y-1.5 text-center">
              <Badge variant="gold" className="text-[10px] mb-2 px-2.5 py-0.5">
                <Lock className="h-3 w-3 text-[#C9A961] mr-1.5 inline" /> Secure Agent Workspace Access
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Sign in to your account
              </h1>
              <p className="text-xs text-[#9A9AA5] leading-relaxed">
                Access active transaction portfolios, review extracted contract deadlines, and monitor automated alerts.
              </p>
            </div>

            {inviteToken && (
              <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
                <UserCheck className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                <div className="space-y-0.5 text-left">
                  <span className="font-semibold text-sky-100 block">Workspace Invitation Active</span>
                  <span className="text-[11px] text-sky-300 block">
                    Signing in with Google will automatically bind your account to the inviting organization.
                  </span>
                </div>
              </div>
            )}

            {/* Google OAuth Render Container */}
            <div className="flex min-h-[48px] w-full flex-col justify-center items-center py-2 overflow-hidden">
              {signingIn && (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-[#181820] border border-[#C9A961]/30 px-4 py-2.5 text-xs font-medium text-[#C9A961] w-full">
                  <Loader2 className="h-4 w-4 animate-spin text-[#C9A961] shrink-0" />
                  <span className="truncate">Authenticating secure session...</span>
                </div>
              )}
              <div
                ref={buttonRef}
                className={`flex w-full justify-center overflow-hidden transition-all ${
                  signingIn ? 'hidden' : 'block'
                }`}
              />
              {!ready && !signingIn && !error && (
                <div className="h-11 w-full animate-pulse rounded-xl bg-[#1A1A22] flex items-center justify-center text-xs text-[#9A9AA5]">
                  Initializing Google SSO...
                </div>
              )}
            </div>

            {demoLoginEnabled && (
              <div className="space-y-3 pt-1">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Sandbox Testing
                  </span>
                  <div className="flex-grow border-t border-white/10" />
                </div>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={signingIn}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-slate-600 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Enter Demo Sandbox (Advisor Role)</span>
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="border-t border-white/[0.08] pt-4 space-y-2 text-center">
              <div className="flex items-center justify-center gap-2 text-[11px] text-[#9A9AA5]">
                <UserCheck className="h-3.5 w-3.5 text-[#C9A961]" />
                <span>Auto-provisioned Agent Workspace profile</span>
              </div>
              <p className="text-[11px] text-[#6E6E7A] leading-relaxed">
                By signing in, you accept brokerage legal compliance terms and AES-256 data protection guidelines.
              </p>
            </div>
          </div>

          {/* Quick Footer Navigation */}
          <div className="flex items-center justify-center gap-4 text-xs text-[#6E6E7A]">
            <Link to="/" className="hover:text-[#C9A961] transition-colors">Home Page</Link>
            <span>&bull;</span>
            <Link to="/pricing" className="hover:text-[#C9A961] transition-colors">Pricing</Link>
            <span>&bull;</span>
            <Link to="/security" className="hover:text-[#C9A961] transition-colors">Security</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
