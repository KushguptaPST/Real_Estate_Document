import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  PhoneCall,
  Code,
  Building2,
  Loader2,
  Sparkles,
  ExternalLink,
  Clock,
  Send,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { organizationApi, propertiesApi } from '@/services/api';
import { BrochureUploadField } from '@/components/property/BrochureUploadField';
import { WorkspacePageSkeleton } from '@/components/ui/skeleton';

type OnboardingPayload = Awaited<ReturnType<typeof organizationApi.getOnboarding>>;

export function OnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<OnboardingPayload | null>(
    () => organizationApi.getCachedOnboarding(),
  );
  const [loading, setLoading] = useState(() => !organizationApi.getCachedOnboarding());
  const [activeStep, setActiveStep] = useState<1 | 2>(() =>
    organizationApi.getCachedOnboarding()?.checklist?.telegramConnected ? 2 : 1,
  );
  const [busy, setBusy] = useState(false);

  // Step 1: Telegram Bot (Live Now — ₹0)
  const [telegramToken, setTelegramToken] = useState('');
  const [showReplaceToken, setShowReplaceToken] = useState(false);

  // Step 2: First Property + Advisor Phone
  const [propTitle, setPropTitle] = useState('');
  const [propCity, setPropCity] = useState('Bengaluru');
  const [propMicroMarket, setPropMicroMarket] = useState('Whitefield');
  const [propPrice, setPropPrice] = useState('18500000');
  const [propBedrooms, setPropBedrooms] = useState('3');
  const [propBrochureUrl, setPropBrochureUrl] = useState('');
  const [advisorPhone, setAdvisorPhone] = useState('');

  const loadOnboarding = useCallback(async () => {
    const hasWarmCache = Boolean(organizationApi.getCachedOnboarding());
    try {
      if (!hasWarmCache) setLoading(true);
      const res = await organizationApi.getOnboarding();
      setData(res);
      if (res.checklist.telegramConnected) {
        setActiveStep((prev) => (prev === 1 ? 2 : prev));
      }
    } catch (err: any) {
      if (!hasWarmCache) toast.error(err.message || 'Failed to load setup status');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOnboarding();
  }, [loadOnboarding]);

  const handleConnectTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = telegramToken.trim();
    if (!clean || !clean.includes(':')) {
      toast.error('Paste a valid Telegram Bot Token from @BotFather (e.g. 123456789:ABC...)');
      return;
    }

    try {
      setBusy(true);
      const res = await organizationApi.connectTelegram(clean);
      toast.success(`Telegram bot @${res.telegramBotUsername} verified and live!`);
      setTelegramToken('');
      setShowReplaceToken(false);
      await loadOnboarding();
      setActiveStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Invalid Telegram Bot Token or network error');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      if (advisorPhone.trim() && user?.id) {
        await organizationApi.updateMemberPhone(user.id, advisorPhone.trim());
      }
      if (propTitle.trim()) {
        await propertiesApi.create({
          title: propTitle.trim(),
          address: `${propMicroMarket}, ${propCity}`,
          city: propCity.trim(),
          price: Number(propPrice) || 15000000,
          bedrooms: Number(propBedrooms) || 3,
          bathrooms: 2,
          propertyType: 'APARTMENT',
          ...(propBrochureUrl.trim() ? { brochureUrl: propBrochureUrl.trim() } : {}),
        });
      }
      await organizationApi.completeOnboarding();
      toast.success('Workspace activated! Your Telegram AI Advisor & Deal Copilot are live.');
      navigate('/leads');
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate workspace');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return <WorkspacePageSkeleton variant="onboarding" />;
  }

  const steps = [
    { id: 1 as const, title: 'Telegram AI Bot', done: data.checklist.telegramConnected, icon: Send },
    { id: 2 as const, title: 'Inventory & Advisor', done: data.checklist.hasInventory || data.onboardingCompleted, icon: Building2 },
  ];

  const futureChannels = [
    {
      title: 'WhatsApp Business Cloud API',
      desc: 'Meta Coexistence mode, PDF brochure dispatch, and interactive buyer buttons.',
      icon: MessageSquare,
    },
    {
      title: 'Plivo India AI Voice Calling',
      desc: 'Indian DIDs, outbound speed-to-lead cold calling, and live warm transfers.',
      icon: PhoneCall,
    },
    {
      title: 'Embeddable Website Chat Widget',
      desc: 'One-line JS widget script to qualify visitors on your brokerage website.',
      icon: Code,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Telegram AI Channel Setup &bull; ₹0 Messaging Cost
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Activate {data.organizationName}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Connect your free Telegram AI Bot and add your first property listing so buyers can chat &amp; book site visits right away.
          </p>
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-900 shrink-0 self-start md:self-auto">
          {data.checklist.telegramConnected
            ? `@${data.details.telegramBotUsername} Live`
            : '2-Minute Setup'}
        </div>
      </div>

      {/* 2-Step Stepper */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = activeStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStep(s.id)}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="h-4 w-4" />
                {s.done ? (
                  <CheckCircle2 className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-600'}`} />
                ) : (
                  <Circle className="h-4 w-4 opacity-40" />
                )}
              </div>
              <p className="text-sm font-semibold">{s.id}. {s.title}</p>
            </button>
          );
        })}
      </div>

      {/* Active Step Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        {activeStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Connect Your Free Telegram AI Bot</h2>
              <p className="text-xs text-slate-600 mt-1">
                Zero monthly carrier fees, zero templates required, and instant live two-way replies on mobile and desktop.
              </p>
            </div>

            {data.checklist.telegramConnected && !showReplaceToken ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-950">
                      Telegram Bot Verified &amp; Active (@{data.details.telegramBotUsername})
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      Verified via Telegram Bot API. Send any message to your bot on Telegram to qualify leads and log CRM threads automatically.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {data.details.telegramBotUsername && (
                    <a
                      href={`https://t.me/${data.details.telegramBotUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                    >
                      <span>Open Bot</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowReplaceToken(true)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Change Token
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Next Step →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnectTelegram} className="space-y-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">How to get your free token in 30 seconds:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Open Telegram and message{' '}
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-emerald-700 underline"
                      >
                        @BotFather
                      </a>
                    </li>
                    <li>Send <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">/newbot</code>, choose a name &amp; username ending in <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">bot</code></li>
                    <li>Copy the HTTP API token it gives you and paste it below.</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Telegram Bot Token
                  </label>
                  <input
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  {showReplaceToken ? (
                    <button
                      type="button"
                      onClick={() => setShowReplaceToken(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Token is validated live against Telegram before saving.
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{busy ? 'Verifying with Telegram...' : 'Verify & Connect Bot'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <form onSubmit={handleFinishSetup} className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">2. First Property Inventory &amp; Advisor Contact</h2>
            <p className="text-xs text-slate-600">
              Your Telegram AI strictly recommends verified listings stored here and routes escalation callbacks to your advisor.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={advisorPhone} onChange={(e) => setAdvisorPhone(e.target.value)} placeholder="Advisor Mobile for Callbacks (+91...)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono" />
              <input value={propTitle} onChange={(e) => setPropTitle(e.target.value)} placeholder="First Project Title (e.g. Emerald Towers)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <input value={propMicroMarket} onChange={(e) => setPropMicroMarket(e.target.value)} placeholder="Micro-market (e.g. Whitefield)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <input value={propCity} onChange={(e) => setPropCity(e.target.value)} placeholder="City (e.g. Bengaluru)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <input value={propPrice} onChange={(e) => setPropPrice(e.target.value)} placeholder="Price in INR (e.g. 18500000)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono" />
              <input value={propBedrooms} onChange={(e) => setPropBedrooms(e.target.value)} placeholder="Bedrooms (e.g. 3)" className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono" />
              <BrochureUploadField
                value={propBrochureUrl}
                onChange={setPropBrochureUrl}
                className="md:col-span-2 pt-1"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4 text-xs">
              <span className="font-semibold text-slate-700">Activation Readiness:</span>
              <span className={data.checklist.telegramConnected ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                {data.checklist.telegramConnected ? `✓ Telegram Bot Live (@${data.details.telegramBotUsername})` : '• Telegram Bot Pending'}
              </span>
              <span className={advisorPhone.trim() || data.checklist.hasAdvisorPhone ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                {advisorPhone.trim() || data.checklist.hasAdvisorPhone ? '✓ Advisor Contact Set' : '• Advisor Phone Optional'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                ← Back to Telegram Setup
              </button>
              <button type="submit" disabled={busy} className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
                {busy ? 'Activating...' : 'Complete Setup & Open Lead Pipeline'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Upcoming / Future Channels */}
      <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Upcoming Channel Integrations</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These channels are scheduled for future rollout; Telegram Bot is the active channel right now.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3" /> Roadmap
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {futureChannels.map((ch) => {
            const Icon = ch.icon;
            return (
              <div key={ch.title} className="p-4 rounded-xl bg-white border border-slate-200/80 opacity-80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-slate-500" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800">{ch.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{ch.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
