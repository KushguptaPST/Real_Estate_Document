import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  Mail,
  KeyRound,
  Compass,
  Zap,
  Check,
  Loader2,
  AlertCircle,
  Volume2,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { billingApi } from '@/services/api';

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
    monthlyPrice: 4999,
    annualPrice: 3999,
    tagline: 'For independent brokers & CPs closing active buyer inquiries',
    features: [
      'Sub-15s WhatsApp Speed-to-Lead Auto-Reply',
      'Up to 15 active buyer deals & client memory',
      'Digital Brochure PDF & Floor Plan Dispatch',
      'Site Visit Walk-in Scheduler & Google Maps Pin',
      'Indian Rupee (₹ Lakhs & Crores) Tracking',
    ],
  },
  {
    id: 'TEAM' as const,
    name: 'Brokerage Team',
    badge: 'Most Popular',
    monthlyPrice: 14999,
    annualPrice: 11999,
    tagline: 'For high-producing teams, mandate agencies & brokerages',
    popular: true,
    features: [
      'Omnichannel WhatsApp Business & Voice Notes',
      'Meta (FB/IG) Lead Ads & 99acres Sync',
      'Plivo Speed-to-Lead Outbound Calling',
      'Up to 10 Agent & Telecaller workspace seats',
      'Unlimited Active Deals & Model Flat Walkthroughs',
      '45-Day Lead Protection & Claim Lock for Agents',
      '18% GST Input Tax Credit (ITC) Invoices',
    ],
  },
  {
    id: 'ENTERPRISE' as const,
    name: 'Developer / Builder Enterprise',
    badge: 'Builder Scale',
    monthlyPrice: 39999,
    annualPrice: 31999,
    tagline: 'For multi-project developers and high-volume mandate firms',
    popular: false,
    features: [
      'Unlimited Calling Seats & In-House Telecallers',
      'Multi-Project Inventory & Master Stacking',
      'Custom Agent Hinglish Voice Cloning Digital Twin',
      'High-Scale Batch Campaign Dialing Center',
      'Dedicated Real-Time Webhook Pipeline & CRM API',
      'Priority 24/7 Account Manager & Dedicated Onboarding',
    ],
  },
];

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { registerOrg } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<'SOLO' | 'TEAM' | 'ENTERPRISE'>(
    (searchParams.get('plan') as 'SOLO' | 'TEAM' | 'ENTERPRISE') || 'TEAM',
  );
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('KA');
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!formData.ownerName.trim()) errs.ownerName = 'Managing broker name is required.';
    if (!formData.email.trim()) {
      errs.email = 'Valid work email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please provide a valid email format.';
    }
    if (!formData.password) {
      errs.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!formData.organizationName.trim()) {
      errs.organizationName = 'Brokerage or team name is required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
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
    setLoading(true);
    setErrors({});

    try {
      // 1. Atomically register Organization and Owner user
      await registerOrg({
        ownerName: formData.ownerName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        organizationName: formData.organizationName.trim(),
        stateJurisdiction: selectedJurisdiction,
        planTier: selectedPlan,
      });

      toast.success(
        `Welcome ${formData.ownerName}. Your brokerage workspace is activated on the ${selectedPlan} plan.`,
        'Workspace Created!',
      );

      // 2. Try creating checkout session or direct to dashboard
      try {
        const checkout = await billingApi.createCheckoutSession({
          plan: selectedPlan,
          isAnnual,
          successUrl: `${window.location.origin}/deals?checkout=success&plan=${selectedPlan}`,
          cancelUrl: `${window.location.origin}/pricing?checkout=cancelled`,
        });

        if (checkout.url && !checkout.mock) {
          window.location.href = checkout.url;
          return;
        }
      } catch (billingErr) {
        console.warn('Billing checkout redirect fallback:', billingErr);
      }

      // Default redirect to Deals pipeline
      navigate('/deals', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check your inputs.';
      setErrors({ form: msg });
      toast.error(msg, 'Registration Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans flex flex-col justify-between">
      {/* ── Top Pinned Header ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-[#E5E7EB]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A0A0A] text-white shadow-xs group-hover:scale-105 transition-transform">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-[#0A0A0A] block leading-none">
              Contingency Copilot
            </span>
            <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">
              Brokerage Workspace Onboarding
            </span>
          </div>
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
                Owner Profile
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

          {/* STEP 1: Owner Profile */}
          {step === 1 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="text-center space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">
                  Step 1 of 3
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                  Create your Broker Owner Profile
                </h2>
                <p className="text-xs text-[#52525B]">
                  You will have primary administrator privileges over your brokerage pipeline and escrow vault.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                    Managing Broker / Agent Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      placeholder="e.g. Sarah Jenkins, Broker"
                      className={`w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${
                        errors.ownerName ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200'
                      }`}
                    />
                  </div>
                  {errors.ownerName && <p className="text-[11px] text-red-600 mt-1">{errors.ownerName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                    Direct Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="broker@yourbrokerage.com"
                      className={`w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${
                        errors.email ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200'
                      }`}
                    />
                  </div>
                  {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                      Account Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="At least 6 characters"
                        className={`w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${
                          errors.password ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200'
                        }`}
                      />
                    </div>
                    {errors.password && <p className="text-[11px] text-red-600 mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                        className={`w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${
                          errors.confirmPassword ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200'
                        }`}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-[11px] text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 bg-[#0A0A0A] hover:bg-zinc-800 text-white font-semibold text-xs shadow-xs transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Continue to Brokerage Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
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
                  Select your primary state licensing body to configure deterministic business-day and deadline calculation rules.
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
                      value={formData.organizationName}
                      onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                      placeholder="e.g. Prestige Estates, Sobha Realty, or Apex Channel Partners"
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

                {/* Billing Toggle */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className={`text-xs font-medium ${!isAnnual ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
                    Monthly Billing
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(!isAnnual)}
                    className="relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border border-zinc-200 bg-white transition-colors duration-200 ease-in-out"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#0A0A0A] mt-1 ml-1 shadow transition duration-200 ease-in-out ${
                        isAnnual ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${isAnnual ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
                      Annual Billing
                    </span>
                    <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                      Save 20%
                    </span>
                  </div>
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
                          {isSelected ? 'Selected Platform Tier' : 'Select Plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

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
                      Ready to launch {formData.organizationName || 'your brokerage'}
                    </span>
                    <span className="text-[11px] text-zinc-500 block font-mono">
                      Market: {selectedJurisdiction} &bull; Tier: {selectedPlan}
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
                        <span>Complete Setup &amp; Activate</span>
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
        <span>&copy; {new Date().getFullYear()} Contingency Copilot Inc. &bull; AES-256 Vault &bull; SOC2 Type II Certified</span>
      </footer>
    </div>
  );
}
