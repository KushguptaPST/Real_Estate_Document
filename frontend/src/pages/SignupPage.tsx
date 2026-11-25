import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { billingApi, organizationApi } from '@/services/api';
import { openRazorpayCheckout } from '@/utils/razorpay';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

const JURISDICTIONS = [
  {
    id: 'KA',
    label: 'Bengaluru & Karnataka',
    description: 'Whitefield, Sarjapur, Indiranagar, Bellandur, North Bengaluru IT corridors',
    popular: true,
  },
  {
    id: 'MH',
    label: 'Mumbai MMR & Pune',
    description: 'Bandra, Andheri, Thane, Navi Mumbai, and Pune Hinjewadi/Kharadi clusters',
    popular: true,
  },
  {
    id: 'HR',
    label: 'Gurugram & Delhi-NCR',
    description: 'Golf Course Extension, Dwarka Expressway, Cyber City, and Noida Expressways',
    popular: true,
  },
  {
    id: 'TS',
    label: 'Hyderabad (Cyberabad)',
    description: 'Gachibowli, Hitec City, Kokapet, and Financial District high-growth tech corridor',
    popular: true,
  },
];

const PLANS = [
  {
    id: 'SOLO' as const,
    name: 'Solo Channel Partner',
    badge: 'Starter',
    monthlyPrice: 7499,
    annualPrice: 5999,
    includedCreditsInr: 6000,
    tagline: 'Daily AI cold calling (~40–50 dials/day) + WhatsApp',
    features: [
      '500 AI Calling Mins (~1,000–1,250 cold dials/mo)',
      '₹0 on unanswered dials • 30s pulse billing (₹12/min)',
      'ElevenLabs Studio Voice + 1 Plivo India DID',
      'Unlimited Website Chat Widget & Telegram Bot',
      'WhatsApp Speed-to-Lead + PDF Brochure & Location Pin',
      'Site Visit Scheduling & Deal Document Copilot (Up to 50 deals)',
    ],
  },
  {
    id: 'TEAM' as const,
    name: 'Brokerage Team',
    badge: 'Most Popular',
    monthlyPrice: 21999,
    annualPrice: 17599,
    includedCreditsInr: 19200,
    tagline: 'AI Sales Team (~120–150 dials/day + up to 10 seats)',
    popular: true,
    features: [
      '1,600 AI Calling Mins (~3,200–4,000 cold dials/mo)',
      '₹0 on unanswered dials • 30s pulse billing (₹12/min)',
      'ElevenLabs Studio Voice + Plivo Batch Campaign Dialer',
      'Unlimited Website Chat Widget & Telegram Bot',
      'WhatsApp Coexistence (Auto-pause when advisor replies)',
      'Up to 10 Team Seats + Live Warm Call Transfer',
      'CSV Bulk Lead Import & Unlimited Active Deals',
      'Unified Razorpay INR Wallet & Ledger Tracking',
    ],
  },
  {
    id: 'ENTERPRISE' as const,
    name: 'Builder / Mandate Center',
    badge: 'High Volume',
    monthlyPrice: 54999,
    annualPrice: 43999,
    includedCreditsInr: 48000,
    tagline: 'High-scale mandate center (~300+ cold dials/day)',
    popular: false,
    features: [
      '4,000 AI Calling Mins (~8,000–10,000 cold dials/mo)',
      '₹0 on unanswered dials • 30s pulse billing (₹12/min)',
      'Up to 100 Team Seats + Isolated Plivo Subaccount',
      'Multi-Project RERA Inventory & Hybrid Knowledge Search',
      'Tenant API Keys & HMAC-Signed Inbound Lead Webhooks',
      'Unlimited Website Chat Widget, Telegram & Audit Trail',
      'Guided Plivo India KYC & Channel Onboarding',
    ],
  },
];

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signInWithGoogle, refreshUser, signOut } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(() =>
    user?.subscriptionStatus === 'PENDING_PAYMENT' ? 2 : 1,
  );
  const [selectedPlan, setSelectedPlan] = useState<'SOLO' | 'TEAM' | 'ENTERPRISE'>(
    (searchParams.get('plan') as 'SOLO' | 'TEAM' | 'ENTERPRISE') || 'TEAM',
  );
  const [isAnnual, setIsAnnual] = useState(searchParams.get('annual') === 'true');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(user?.stateJurisdiction || 'KA');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activePlan = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];
  const dueTodayInr = isAnnual ? activePlan.annualPrice * 12 : activePlan.monthlyPrice;

  useEffect(() => {
    if (user?.subscriptionStatus === 'PENDING_PAYMENT') {
      setStep((prev) => (prev === 1 ? 2 : prev));
      if (user.stateJurisdiction) setSelectedJurisdiction(user.stateJurisdiction);
      if (user.organizationName && !organizationName && !user.organizationName.endsWith("'s Brokerage")) {
        setOrganizationName(user.organizationName);
      }
    }
  }, [user, organizationName]);

  const handleGoogleStep = async (credential: string) => {
    setErrors({});
    const res = await signInWithGoogle(credential);
    if (!res.isNewWorkspace && res.user.subscriptionStatus !== 'PENDING_PAYMENT') {
      toast.success('Welcome back to your active brokerage workspace.');
      navigate('/deals', { replace: true });
      return;
    }
    toast.success(`Verified ${res.user.email} via Google`);
    setStep(2);
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!organizationName.trim() || organizationName.trim().length < 2) {
      errs.organizationName = 'Brokerage or team name is required (min 2 characters).';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && user) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    if (!user) {
      setStep(1);
      setErrors({ form: 'Please verify your Google account first.' });
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // 1. Save Brokerage Name, Market & Selected Plan on the Google-verified workspace
      await organizationApi.updateWorkspaceProfile({
        organizationName: organizationName.trim(),
        stateJurisdiction: selectedJurisdiction,
        planTier: selectedPlan,
      });

      // 2. Single unified Razorpay Checkout (activates plan + auto-credits included AI & Calling credits)
      const order = await billingApi.createRazorpayOrder({
        type: 'SUBSCRIPTION_PLAN',
        plan: selectedPlan,
        isAnnual,
      });
      const rzpResponse = await openRazorpayCheckout(order);
      const verified = await billingApi.verifyRazorpayPayment({
        ...rzpResponse,
        type: 'SUBSCRIPTION_PLAN',
        plan: selectedPlan,
        isAnnual,
      });

      await refreshUser();

      toast.success(
        `Plan activated with ₹${(verified.includedCreditsInr ?? verified.newBalance ?? 0).toLocaleString('en-IN')} AI & Calling credits included.`,
        `${selectedPlan} Workspace Live!`,
      );

      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment did not complete. Click Pay via Razorpay & Activate to retry.';
      setErrors({ form: msg });
      toast.error(msg, 'Complete Razorpay Payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans flex flex-col justify-between">
      {/* ── Top Pinned Header ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-[#E5E7EB]">
        <Link to="/" className="flex items-center gap-3 group py-1">
          <img
            src="/brand/eigen-estate-full.png"
            alt="EigenEstate"
            className="h-8 w-auto object-contain hover:opacity-90 transition-opacity"
          />
          <span className="hidden sm:inline-block text-[11px] text-zinc-400 font-medium pl-3 border-l border-zinc-200">
            Brokerage Workspace Onboarding
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500 hidden sm:inline">Already have a brokerage account?</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all shadow-2xs"
          >
            <span>Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-10 sm:px-6">
        {/* Wizard Progress Stepper */}
        <div className="mb-10 max-w-xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-200 -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-[#0A0A0A] -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />

            {/* Step 1 Indicator */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                  step >= 1
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-white text-zinc-400 border border-zinc-200'
                }`}
              >
                {step > 1 ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${step >= 1 ? 'text-[#0A0A0A] font-bold' : 'text-zinc-400'}`}>
                Google Account
              </span>
            </div>

            {/* Step 2 Indicator */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                  step >= 2
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-white text-zinc-400 border border-zinc-200'
                }`}
              >
                {step > 2 ? <Check className="h-4 w-4" /> : '2'}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${step >= 2 ? 'text-[#0A0A0A] font-bold' : 'text-zinc-400'}`}>
                Brokerage &amp; State
              </span>
            </div>

            {/* Step 3 Indicator */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                  step === 3
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-white text-zinc-400 border border-zinc-200'
                }`}
              >
                3
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${step === 3 ? 'text-[#0A0A0A] font-bold' : 'text-zinc-400'}`}>
                Plan Tier
              </span>
            </div>
          </div>
        </div>

        {/* Wizard Card Body */}
        <div className="bg-white border border-[#E5E7EB] shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-3xl p-6 sm:p-10 transition-all text-left">
          {errors.form && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* STEP 1: Verified Google Sign-In (Zero Passwords) */}
          {step === 1 && (
            <div className="space-y-6 max-w-md mx-auto">
              <div className="text-center space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">
                  Step 1 of 3
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                  Verify Your Google Account
                </h2>
                <p className="text-xs text-[#52525B]">
                  Sign in with your verified Gmail or Google Workspace email—no unverified emails or passwords required.
                </p>
              </div>

              {user ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-950 truncate">
                        Verified as {user.name || user.email}
                      </p>
                      <p className="text-[11px] text-emerald-800 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 bg-[#0A0A0A] hover:bg-zinc-800 text-white font-semibold text-xs cursor-pointer"
                    >
                      <span>Continue to Brokerage Profile</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      className="px-4 py-2.5 rounded-full border border-emerald-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      Switch Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <GoogleSignInButton
                    onCredential={handleGoogleStep}
                    onError={(msg) => setErrors({ form: msg })}
                    text="continue_with"
                  />
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200/70 px-3 py-2.5 text-[11px] text-zinc-600">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>If your brokerage already exists, you&apos;ll be signed straight in.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Brokerage Name & Jurisdiction */}
          {step === 2 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">
                  Step 2 of 3
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                  Brokerage Firm &amp; State Jurisdiction
                </h2>
                <p className="text-xs text-[#52525B]">
                  {user ? `Signed in with Google (${user.email}). ` : ''}Select your primary market hub to configure AI lead qualification rules.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                    Brokerage Firm or Team Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="e.g. Eigen Estate, Prestige Realty, or Apex Advisory"
                      className={`w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${
                        errors.organizationName ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200'
                      }`}
                    />
                  </div>
                  {errors.organizationName && (
                    <p className="text-[11px] text-red-600 mt-1">{errors.organizationName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-2">
                    Primary Real Estate Market Hub
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {JURISDICTIONS.map((j) => (
                      <div
                        key={j.id}
                        onClick={() => setSelectedJurisdiction(j.id)}
                        className={`cursor-pointer rounded-2xl p-4 border transition-all text-left relative ${
                          selectedJurisdiction === j.id
                            ? 'border-[#0A0A0A] bg-zinc-50 shadow-2xs'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-zinc-900">{j.label}</span>
                          {selectedJurisdiction === j.id ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-zinc-300" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#52525B] leading-relaxed">{j.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3 bg-[#0A0A0A] hover:bg-zinc-800 text-white font-semibold text-xs shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Continue to Plan Selection</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Plan Selection & Submission */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">
                  Final Step
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
                  Select your Brokerage Platform Tier
                </h2>
                <p className="text-xs text-[#52525B] max-w-xl mx-auto">
                  Every plan includes speed-to-lead AI sales capabilities, 50-state statutory date surveillance, and verifiable contract citations.
                </p>

                {/* Billing Cycle Selector */}
                <div className="mt-4 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setIsAnnual(false)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      !isAnnual
                        ? 'bg-[#0A0A0A] text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(true)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      isAnnual
                        ? 'bg-[#0A0A0A] text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <span>Annual Billing</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {PLANS.map((plan) => {
                  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`cursor-pointer rounded-3xl p-6 border transition-all flex flex-col justify-between relative ${
                        isSelected
                          ? 'border-[#0A0A0A] bg-zinc-50 shadow-md ring-1 ring-black'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white shadow-2xs'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-[#0A0A0A] text-white font-semibold text-[10px] px-3 py-1 rounded-full shadow-xs">
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-base font-bold text-zinc-900">{plan.name}</h3>
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-zinc-300" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#52525B] mb-4">{plan.tagline}</p>

                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-extrabold text-[#0A0A0A] font-mono">₹{price.toLocaleString('en-IN')}</span>
                          <span className="text-xs text-zinc-500">/ mo</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mb-6 font-mono">
                          {isAnnual ? `Billed annually (₹${(price * 12).toLocaleString('en-IN')}/yr + 18% GST)` : 'Billed monthly (+ 18% GST)'}
                        </p>

                        <div className="border-t border-zinc-200 pt-4 space-y-2.5">
                          {plan.features.map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-zinc-700">
                              <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-6">
                        <button
                          type="button"
                          className={`w-full rounded-full text-xs font-semibold py-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#0A0A0A] text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select Plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Error Banner */}
              {errors.form && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-900 flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              {/* Bottom Submit Actions */}
              <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-bold text-zinc-900 block">
                      Total due today: ₹{dueTodayInr.toLocaleString('en-IN')}{' '}
                      <span className="font-normal text-zinc-500">
                        ({isAnnual ? '12 months annual' : 'monthly'})
                      </span>
                    </span>
                    <span className="text-[11px] text-zinc-500 block font-mono">
                      {organizationName || 'Your Brokerage'} &bull; {selectedJurisdiction} &bull; Includes ₹{activePlan.includedCreditsInr.toLocaleString('en-IN')} AI credits
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] hover:bg-zinc-800 text-white font-semibold px-8 py-3.5 text-xs shadow-md transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Activating Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ₹{dueTodayInr.toLocaleString('en-IN')} via Razorpay</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-zinc-400 border-t border-[#E5E7EB]">
        <span>&copy; {new Date().getFullYear()} Eigen Estate Inc. &bull; eigenestate.com &bull; Google-Verified Auth &bull; Tenant-Isolated Audit Trail</span>
      </footer>
    </div>
  );
}
