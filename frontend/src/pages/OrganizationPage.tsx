import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle2,
  Key,
  Copy,
  Check,
  Loader2,
  Trash2,
  Palette,
  Code,
  Mail,
  AlertCircle,
  ExternalLink,
  Shield,
  UserCheck,
  PhoneCall,
  Phone,
  Bot,
  Mic,
  Radio,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { organizationApi, voiceApi } from '@/services/api';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'AGENT';
  status: 'ACTIVE' | 'PENDING';
  joinedAt: string;
  isInvite?: boolean;
}

export function OrganizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    memberId: string;
    isInvite?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    memberId: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Organization Branding Settings
  const [orgName, setOrgName] = useState(
    user?.organizationId === 'demo-sandbox-org' ? 'Demo Sandbox Brokerage' : 'Apex Brokerage Group'
  );
  const [customDomain, setCustomDomain] = useState('ai.apexbrokerage.com');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [aiPersona, setAiPersona] = useState('PROFESSIONAL');
  const [maxAutoBudget, setMaxAutoBudget] = useState('2500000');
  const [savedBranding, setSavedBranding] = useState(false);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'AGENT'>('AGENT');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    email: string;
    inviteUrl: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);

  // Voice Telephony & Sandbox Test Dialer State
  const [testPhoneInput, setTestPhoneInput] = useState('+1');
  const [dialingTest, setDialingTest] = useState(false);
  const [copiedMetaWebhook, setCopiedMetaWebhook] = useState(false);
  const [copiedVerifyToken, setCopiedVerifyToken] = useState(false);

  const metaWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/inbound/meta` : 'https://api.contingencycopilot.com/api/inbound/meta';
  const metaVerifyToken = 'contingency_copilot_meta_webhook_secret';

  const handleOrgTestCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneInput.trim()) return;
    try {
      setDialingTest(true);
      const res = await voiceApi.triggerTestCall(testPhoneInput.trim());
      if (res.success) {
        toast.success(
          res.isSimulated
            ? `[Simulation] Test call triggered for ${testPhoneInput}. WebSocket stream initiated.`
            : `Call initiated! Your phone (${testPhoneInput}) will ring in ~4 seconds.`
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch test call');
    } finally {
      setDialingTest(false);
    }
  };

  // Team Members & Invitations State
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const webhookSecret = 'whsec_copilot_b2b_9f8a7b6c5d4e3f2a1';
  const embedCodeSnippet = `<script src="https://cdn.contingencycopilot.com/widget.js" data-org="${user?.organizationId || 'demo-sandbox-org'}" async></script>`;

  const fetchMembersAndInvites = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const [membersRes, invitesRes] = await Promise.allSettled([
        organizationApi.listMembers(),
        organizationApi.listInvitations(),
      ]);

      const membersList: TeamMember[] = [];

      if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) {
        membersRes.value.forEach((m) => {
          membersList.push({
            id: m.id,
            name: m.name || m.email.split('@')[0],
            email: m.email,
            role: m.role as 'OWNER' | 'AGENT',
            status: 'ACTIVE',
            joinedAt: m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '2026-01-15',
            isInvite: false,
          });
        });
      }

      if (invitesRes.status === 'fulfilled' && Array.isArray(invitesRes.value)) {
        invitesRes.value
          .filter((inv) => inv.status === 'PENDING')
          .forEach((inv) => {
            membersList.push({
              id: inv.id,
              name: inv.email.split('@')[0],
              email: inv.email,
              role: inv.role as 'OWNER' | 'AGENT',
              status: 'PENDING',
              joinedAt: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : 'Pending',
              isInvite: true,
            });
          });
      }

      setTeamMembers(membersList);
    } catch (err: any) {
      console.warn('Failed to fetch team members:', err);
      toast.error('Failed to load team members from server');
    } finally {
      setLoadingMembers(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMembersAndInvites();
  }, [fetchMembersAndInvites]);

  function handleCopyWebhookSecret() {
    navigator.clipboard.writeText(webhookSecret);
    setCopiedKey(true);
    toast.success('Webhook secret copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleCopyEmbedSnippet() {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedSnippet(true);
    toast.success('Live chat embed code copied to clipboard');
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  function handleCopyInviteUrl() {
    if (inviteSuccessData?.inviteUrl) {
      navigator.clipboard.writeText(inviteSuccessData.inviteUrl);
      setCopiedInviteUrl(true);
      toast.success('One-time invitation URL copied to clipboard');
      setTimeout(() => setCopiedInviteUrl(false), 2000);
    }
  }

  function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavedBranding(true);
    toast.success('Brokerage workspace and AI persona settings saved');
    setTimeout(() => setSavedBranding(false), 2500);
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setSendingInvite(true);
      setInviteError(null);
      const res = await organizationApi.sendInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setInviteSuccessData({
        email: inviteEmail.trim(),
        inviteUrl: res.inviteUrl,
        emailSent: res.emailSent,
        emailError: res.emailError,
      });

      toast.success(`Invitation created for ${inviteEmail.trim()}`);
      setInviteEmail('');
      fetchMembersAndInvites();
    } catch (err: any) {
      const msg = err.message || 'Failed to dispatch email invitation. Please check configuration.';
      setInviteError(msg);
      toast.error(msg);
    } finally {
      setSendingInvite(false);
    }
  }

  function promptRemoveMember(memberId: string, isInvite?: boolean) {
    setConfirmModal({
      isOpen: true,
      title: isInvite ? 'Revoke Pending Invitation' : 'Remove Team Member',
      message: isInvite
        ? 'Are you sure you want to revoke this invitation token? The invite link will no longer function.'
        : 'Are you sure you want to remove this agent from the organization? They will immediately lose access to deals and leads.',
      memberId,
      isInvite,
    });
  }

  async function handleConfirmRemove() {
    try {
      setActionLoading(true);
      if (confirmModal.isInvite) {
        await organizationApi.revokeInvitation(confirmModal.memberId);
        toast.success('Invitation successfully revoked');
      } else {
        await organizationApi.removeMember(confirmModal.memberId);
        toast.success('Team member removed from organization');
      }
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      fetchMembersAndInvites();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: 'OWNER' | 'AGENT') {
    try {
      await organizationApi.changeMemberRole(memberId, newRole);
      toast.success(`Role updated to ${newRole === 'OWNER' ? 'Broker Admin' : 'Agent'}`);
      fetchMembersAndInvites();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change role');
    }
  }

  const activeSeats = teamMembers.filter((m) => m.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 pb-12 max-w-[1600px] mx-auto">
      {/* ── B2B Header Card ── */}
      <div className="bg-white border border-slate-200/90 p-8 rounded-2xl relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> B2B Enterprise Workspace
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold border border-slate-200">
                {activeSeats} / 10 Agent Seats Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              {orgName}
            </h1>
            <p className="text-xs text-slate-500 max-w-xl">
              Manage licensed agents, role-based access control, AI persona guidelines, and integration credentials.
            </p>
          </div>

          {user?.role === 'OWNER' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-semibold transition-all shadow-xs self-start md:self-auto cursor-pointer"
            >
              <UserPlus className="h-4 w-4" /> Invite Team Member
            </button>
          )}
        </div>
      </div>

      {/* ── 2-Column Section: White-Label Branding & AI Persona ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* White-Label Branding Form */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Palette className="h-4.5 w-4.5 text-emerald-700" /> Agency Identity &amp; White-Label Branding
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your brokerage workspace title, custom sub-domain, and brand accents.
            </p>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brokerage Brand Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                placeholder="Apex Brokerage Group Inc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Custom Portal Domain</label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors font-mono"
                  placeholder="ai.yourbrokerage.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-12 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {savedBranding ? 'Saved Successfully!' : 'Save Branding'}
              </button>
            </div>
          </form>
        </div>

        {/* AI Tone & Guardrail Tuning */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-emerald-700" /> AI Persona Tone &amp; Guardrails
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the conversational negotiation style for your AI sales copilot across Web and Telegram.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <label
              onClick={() => setAiPersona('PROFESSIONAL')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${aiPersona === 'PROFESSIONAL'
                  ? 'border-slate-900 bg-emerald-50/70 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
            >
              <div>
                <p className="font-semibold text-xs text-slate-900">Senior Broker &amp; Consultative (Recommended)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Formal, authoritative, deeply knowledgeable about local market trends.</p>
              </div>
              <input type="radio" checked={aiPersona === 'PROFESSIONAL'} readOnly className="h-4 w-4 accent-emerald-600" />
            </label>

            <label
              onClick={() => setAiPersona('LUXURY')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${aiPersona === 'LUXURY'
                  ? 'border-slate-900 bg-emerald-50/70 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
            >
              <div>
                <p className="font-semibold text-xs text-slate-900">Luxury &amp; Private Client</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Refined, discreet, tailored for multi-million dollar high-net-worth acquisitions.</p>
              </div>
              <input type="radio" checked={aiPersona === 'LUXURY'} readOnly className="h-4 w-4 accent-emerald-600" />
            </label>

            <label
              onClick={() => setAiPersona('INVESTOR')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${aiPersona === 'INVESTOR'
                  ? 'border-slate-900 bg-emerald-50/70 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700'
                }`}
            >
              <div>
                <p className="font-semibold text-xs text-slate-900">Fast &amp; Metrics-Driven (Investor Focus)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Concise, ROI-focused, immediate cash-flow and cap-rate analysis.</p>
              </div>
              <input type="radio" checked={aiPersona === 'INVESTOR'} readOnly className="h-4 w-4 accent-emerald-600" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Integration Hub & Embed Code Snippet Card ── */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Code className="h-4.5 w-4.5 text-emerald-700" /> 1-Click Website Widget Embed
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Embed this asynchronous widget tag onto your public website to enable instant 24/7 AI lead capture.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-xs overflow-x-auto">
            <span className="flex-1 truncate text-slate-700">{embedCodeSnippet}</span>
            <button
              onClick={handleCopyEmbedSnippet}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 shrink-0 transition-colors cursor-pointer"
            >
              {copiedSnippet ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Autonomous AI Voice Telephony & Omnichannel Messaging Hub (Section 5 & 11) ── */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-purple-600" />
              Autonomous Voice Telephony &amp; Meta WhatsApp Hub
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Managed carrier pool, duplex WebSocket audio streaming, advisor voice cloning &amp; official Meta Cloud API.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Duplex Stream Gateway Active
            </span>
          </div>
        </div>

        {/* 2-Column Grid: Voice Sandbox Dialer & Carrier Line Pool */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: 1-Click Interactive Voice Test Sandbox */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-xl bg-[#0A0A0A] text-white shadow-2xs">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sandbox Test Dialer</h3>
                  <p className="text-[11px] text-slate-500">Duplex AI Live Phone Simulation &bull; Sub-500ms</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                Plivo Stream
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Test your autonomous AI senior advisor directly from your personal mobile phone. Rings in 4 seconds with live real estate negotiation, inventory matching, and interruption barge-in.
            </p>

            <form onSubmit={handleOrgTestCall} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Your Mobile Number (E.164 with Country Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    value={testPhoneInput}
                    onChange={(e) => setTestPhoneInput(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="flex-1 bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={dialingTest || !testPhoneInput.trim()}
                    className="px-4 py-2 bg-[#0A0A0A] hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                  >
                    {dialingTest ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Dialing...
                      </>
                    ) : (
                      <>
                        <PhoneCall className="h-3.5 w-3.5" />
                        Test Call Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Acoustics: Deepgram Nova-2 + Cartesia / ElevenLabs</span>
              <span className="font-semibold text-emerald-700 font-mono">&lt; 450ms Latency</span>
            </div>
          </div>

          {/* Card 2: Meta WhatsApp Cloud API Setup */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Radio className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Meta WhatsApp Cloud API</h3>
                  <p className="text-[11px] text-slate-500">Official Graph API v21.0 Webhook Integration</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                Meta Verified
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Copy these webhook credentials into your <strong>Meta App Dashboard &gt; WhatsApp &gt; Configuration</strong> to receive instant inbound messages and deliver native OGG-OPUS voice notes.
            </p>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Callback Webhook URL</label>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-300 font-mono text-[11px] text-slate-800">
                  <span className="flex-1 truncate">{metaWebhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(metaWebhookUrl);
                      setCopiedMetaWebhook(true);
                      toast.success('Webhook URL copied to clipboard');
                      setTimeout(() => setCopiedMetaWebhook(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                    title="Copy Webhook URL"
                  >
                    {copiedMetaWebhook ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Verify Token</label>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-300 font-mono text-[11px] text-slate-800">
                  <span className="flex-1 truncate">{metaVerifyToken}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(metaVerifyToken);
                      setCopiedVerifyToken(true);
                      toast.success('Verify Token copied to clipboard');
                      setTimeout(() => setCopiedVerifyToken(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                    title="Copy Verify Token"
                  >
                    {copiedVerifyToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advisor Voice Cloning Studio Status */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
              <Mic className="h-4 w-4" />
            </span>
            <div>
              <p className="font-bold text-slate-900">Digital Twin: Cloned Advisor Voice Profile</p>
              <p className="text-[11px] text-slate-500">
                Active Model: <strong>Sarah Jenkins (Managing Broker / Austin Advisory)</strong> &bull; 5 Acoustic Pillars: Room Tone (-48dB), Phone EQ (200-3400Hz), Native OGG-OPUS VoIP
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
            Voice Ready &bull; 48kHz
          </span>
        </div>
      </div>

      {/* ── Team Members Table ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-emerald-700" /> Team Roster &amp; Member Roles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Licensed agents and brokerage managers operating within this organization.</p>
          </div>
          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Tenant Isolated
          </span>
        </div>

        <div className="overflow-x-auto">
          {loadingMembers ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-slate-900" />
              <span>Loading organization members...</span>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No team members registered yet. Invite an agent to get started.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-6">Member Name</th>
                  <th className="py-3 px-6">Email Address</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Joined Date</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{member.name}</span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">{member.email}</td>
                    <td className="py-3.5 px-6">
                      {user?.role === 'OWNER' && !member.isInvite && member.id !== user.id ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as 'OWNER' | 'AGENT')}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-900 cursor-pointer"
                        >
                          <option value="AGENT">Real Estate Advisor</option>
                          <option value="OWNER">Broker Admin</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] ${member.role === 'OWNER'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                        >
                          {member.role === 'OWNER' ? 'Broker Admin' : 'Agent'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${member.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 font-mono">{member.joinedAt}</td>
                    <td className="py-3.5 px-6 text-right">
                      {user?.role === 'OWNER' && member.id !== user.id && (
                        <button
                          onClick={() => promptRemoveMember(member.id, member.isInvite)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={member.isInvite ? 'Revoke Invitation' : 'Remove Team Member'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Webhook & API Key Settings Card ── */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Key className="h-4.5 w-4.5 text-emerald-700" /> Integration API Secret
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Use this organization webhook secret to authenticate inbound leads from Facebook Ads, Zillow, or CRM webhooks.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-xs">
          <span className="flex-1 truncate text-slate-700">{webhookSecret}</span>
          <button
            onClick={handleCopyWebhookSecret}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 shrink-0 transition-colors cursor-pointer"
          >
            {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedKey ? 'Copied' : 'Copy Secret'}</span>
          </button>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-emerald-700" /> Invite Agent to Workspace
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteSuccessData(null);
                  setInviteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-semibold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inviteSuccessData ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <p className="font-semibold mb-1">Invitation Ready for {inviteSuccessData.email}!</p>
                  <p className="text-[11px] text-emerald-700">
                    Share this one-time link with your agent to allow them to join this brokerage workspace:
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-xs">
                  <input
                    type="text"
                    readOnly
                    value={inviteSuccessData.inviteUrl}
                    className="flex-1 bg-transparent border-0 text-slate-800 focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopyInviteUrl}
                    className="px-3 py-1 bg-[#0A0A0A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {copiedInviteUrl ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteSuccessData(null);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                {inviteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Agent Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="agent@brokerage.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'OWNER' | 'AGENT')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
                  >
                    <option value="AGENT">Real Estate Advisor (Standard Permissions)</option>
                    <option value="OWNER">Broker Admin (Full Governance &amp; Billing)</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="px-5 py-2 bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {sendingInvite && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Generate Invite Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={actionLoading}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
