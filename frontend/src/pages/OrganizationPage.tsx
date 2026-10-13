import { useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle2,
  Bot,
  Key,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Trash2,
  Palette,
  Code,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'BROKER_ADMIN' | 'AGENT';
  status: 'ACTIVE' | 'PENDING';
  joinedAt: string;
}

export function OrganizationPage() {
  const { user } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // White-Label Settings State
  const [orgName, setOrgName] = useState('Apex Brokerage Group Inc.');
  const [customDomain, setCustomDomain] = useState('ai.apexbrokerage.com');
  const [primaryColor, setPrimaryColor] = useState('#C9A961');
  const [aiPersona, setAiPersona] = useState('PROFESSIONAL');
  const [maxAutoBudget, setMaxAutoBudget] = useState('2500000');
  const [savedBranding, setSavedBranding] = useState(false);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'BROKER_ADMIN' | 'AGENT'>('AGENT');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Mock Team Members for B2B Agency
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: user?.name || 'Demo Broker Admin',
      email: user?.email || 'admin@brokerage.com',
      role: 'BROKER_ADMIN',
      status: 'ACTIVE',
      joinedAt: '2026-01-15',
    },
    {
      id: '2',
      name: 'Sarah Jenkins',
      email: 'sarah.j@brokerage.com',
      role: 'AGENT',
      status: 'ACTIVE',
      joinedAt: '2026-02-01',
    },
    {
      id: '3',
      name: 'Michael Vance',
      email: 'michael.v@brokerage.com',
      role: 'AGENT',
      status: 'ACTIVE',
      joinedAt: '2026-03-10',
    },
    {
      id: '4',
      name: 'Elena Rostova',
      email: 'elena.r@brokerage.com',
      role: 'AGENT',
      status: 'PENDING',
      joinedAt: '2026-10-01',
    },
  ]);

  const webhookSecret = 'whsec_copilot_b2b_9f8a7b6c5d4e3f2a1';
  const embedCodeSnippet = `<script src="https://cdn.contingencycopilot.com/widget.js" data-org="whsec_copilot_b2b_9f8a7b6c5d4e3f2a1" async></script>`;

  function handleCopyWebhookSecret() {
    navigator.clipboard.writeText(webhookSecret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleCopyEmbedSnippet() {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavedBranding(true);
    setTimeout(() => setSavedBranding(false), 2500);
  }

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingInvite(true);
    setTimeout(() => {
      const newMember: TeamMember = {
        id: String(Date.now()),
        name: inviteEmail.split('@')[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'PENDING',
        joinedAt: new Date().toISOString().split('T')[0],
      };
      setTeamMembers([...teamMembers, newMember]);
      setInviteEmail('');
      setSendingInvite(false);
      setShowInviteModal(false);
    }, 600);
  }

  function handleRemoveMember(memberId: string) {
    if (confirm('Are you sure you want to remove this team member?')) {
      setTeamMembers(teamMembers.filter((m) => m.id !== memberId));
    }
  }

  return (
    <div className="space-y-8 pb-12 max-w-[1600px] mx-auto">
      {/* ── B2B Header Card ── */}
      <div className="bg-[#141418] border border-white/[0.08] p-8 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#34D399]/15 px-2.5 py-0.5 text-xs font-semibold text-[#34D399] border border-[#34D399]/25">
                <CheckCircle2 className="h-3.5 w-3.5" /> B2B Enterprise Workspace
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A961]/15 px-2.5 py-0.5 text-xs font-semibold text-[#C9A961] border border-[#C9A961]/25">
                4 / 10 Agent Seats Used
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
              {orgName}
            </h1>
            <p className="text-xs text-[#9A9AA5] max-w-xl">
              Manage team members, white-label agency branding, AI persona tone, and custom CRM webhook integrations.
            </p>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] px-5 py-2.5 text-xs font-semibold transition-all shadow-md self-start md:self-auto"
          >
            <UserPlus className="h-4 w-4" /> Invite Team Member
          </button>
        </div>
      </div>

      {/* ── 2-Column Section: White-Label Branding & AI Persona ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* White-Label Branding Form */}
        <div className="bg-[#141418] border border-white/[0.08] p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Palette className="h-4.5 w-4.5 text-[#C9A961]" /> White-Label Agency Branding
            </h2>
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              Custom Branding
            </span>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Brokerage Company Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-[#0D0D11] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F7] focus:border-[#C9A961] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Custom Subdomain</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-[#0D0D11] text-[#6E6E7A] rounded-l-xl border border-r-0 border-white/[0.08] font-mono text-[11px]">
                  https://
                </span>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full bg-[#0D0D11] px-3 py-2 rounded-r-xl border border-white/[0.08] font-mono text-[#F5F5F7] focus:outline-none focus:border-[#C9A961] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 rounded-lg border border-white/[0.08] bg-[#0D0D11] cursor-pointer p-0.5"
                  />
                  <span className="font-mono text-[#F5F5F7] font-semibold">{primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Max Auto-Pilot Budget ($)</label>
                <input
                  type="number"
                  value={maxAutoBudget}
                  onChange={(e) => setMaxAutoBudget(e.target.value)}
                  className="w-full bg-[#0D0D11] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F7] font-mono focus:border-[#C9A961] outline-none"
                  placeholder="e.g. 2,500,000"
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold px-5 py-2 text-xs transition-all shadow-sm"
            >
              {savedBranding ? <Check className="h-3.5 w-3.5 text-[#0A0A0B]" /> : <Sparkles className="h-3.5 w-3.5" />}
              {savedBranding ? 'Branding Saved!' : 'Save Branding Preferences'}
            </button>
          </form>
        </div>

        {/* AI Persona & Tone Configurator */}
        <div className="bg-[#141418] border border-white/[0.08] p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Bot className="h-4.5 w-4.5 text-[#C9A961]" /> AI Tone &amp; Persona Selector
            </h2>
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/25">
              Active Persona
            </span>
          </div>

          <p className="text-xs text-[#9A9AA5]">
            Customize how your AI Assistant speaks to prospective buyers across WhatsApp, Live Chat, and Email.
          </p>

          <div className="space-y-2.5 text-xs">
            <label
              onClick={() => setAiPersona('PROFESSIONAL')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                aiPersona === 'PROFESSIONAL'
                  ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#F5F5F7]'
                  : 'border-white/[0.08] bg-[#0D0D11] hover:border-white/20 text-[#9A9AA5]'
              }`}
            >
              <div>
                <p className="font-semibold text-[#F5F5F7]">🌟 Warm &amp; Professional (Recommended)</p>
                <p className="text-[11px] text-[#9A9AA5] mt-0.5">Polite, helpful, consultative. Great for standard buyer inquiries.</p>
              </div>
              <input type="radio" checked={aiPersona === 'PROFESSIONAL'} readOnly className="h-4 w-4 accent-[#C9A961]" />
            </label>

            <label
              onClick={() => setAiPersona('LUXURY')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                aiPersona === 'LUXURY'
                  ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#F5F5F7]'
                  : 'border-white/[0.08] bg-[#0D0D11] hover:border-white/20 text-[#9A9AA5]'
              }`}
            >
              <div>
                <p className="font-semibold text-[#F5F5F7]">💎 Luxury &amp; Exclusive</p>
                <p className="text-[11px] text-[#9A9AA5] mt-0.5">Refined, discreet, high-end vocabulary for luxury estates ($2M+).</p>
              </div>
              <input type="radio" checked={aiPersona === 'LUXURY'} readOnly className="h-4 w-4 accent-[#C9A961]" />
            </label>

            <label
              onClick={() => setAiPersona('INVESTOR')}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                aiPersona === 'INVESTOR'
                  ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#F5F5F7]'
                  : 'border-white/[0.08] bg-[#0D0D11] hover:border-white/20 text-[#9A9AA5]'
              }`}
            >
              <div>
                <p className="font-semibold text-[#F5F5F7]">⚡ Direct &amp; Energetic (Investor Focus)</p>
                <p className="text-[11px] text-[#9A9AA5] mt-0.5">Concise, metrics-driven, fast responses tailored for flippers and REIT investors.</p>
              </div>
              <input type="radio" checked={aiPersona === 'INVESTOR'} readOnly className="h-4 w-4 accent-[#C9A961]" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Integration Hub & Embed Code Snippet Card ── */}
      <div className="bg-[#141418] border border-white/[0.08] p-6 rounded-2xl space-y-4 shadow-xl">
        <div>
          <h2 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Code className="h-4.5 w-4.5 text-[#C9A961]" /> 1-Click Integrations &amp; Website Widget Embed
          </h2>
          <p className="text-xs text-[#9A9AA5] mt-0.5">
            Copy this embed script to add the AI Live Chat Assistant directly to your brokerage website, or connect Zillow and WhatsApp.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#9A9AA5]">Website Live Chat Embed Snippet:</label>
          <div className="flex items-center gap-3 bg-[#0D0D11] text-[#C9A961] p-4 rounded-xl border border-white/[0.08] font-mono text-xs overflow-x-auto">
            <span className="flex-1 truncate">{embedCodeSnippet}</span>
            <button
              onClick={handleCopyEmbedSnippet}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] text-xs font-semibold px-4 py-1.5 shrink-0 transition-all"
            >
              {copiedSnippet ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSnippet ? 'Copied Code!' : 'Copy Snippet'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Team Members Table ── */}
      <div className="bg-[#141418] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-[#C9A961]" /> Organization Team Members
            </h2>
            <p className="text-xs text-[#9A9AA5] mt-0.5">Agents and administrators belonging to your brokerage organization.</p>
          </div>
          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
            Multi-Tenant Isolated Workspace
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D0D11] text-[#9A9AA5] font-semibold border-b border-white/[0.06]">
              <tr>
                <th className="py-3.5 px-6">Member Name</th>
                <th className="py-3.5 px-6">Email Address</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Joined Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-[#F5F5F7]">
              {teamMembers.map((member) => (
                <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#F5F5F7] flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-[#C9A961]/15 text-[#C9A961] font-bold flex items-center justify-center text-xs border border-[#C9A961]/25">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.name}
                  </td>
                  <td className="py-4 px-6 text-[#9A9AA5]">{member.email}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                        member.role === 'BROKER_ADMIN'
                          ? 'bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25'
                          : 'bg-white/[0.06] text-[#9A9AA5] border border-white/[0.08]'
                      }`}
                    >
                      {member.role === 'BROKER_ADMIN' ? 'Broker Admin' : 'Agent'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        member.status === 'ACTIVE'
                          ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/25'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[#6E6E7A] font-mono">{member.joinedAt}</td>
                  <td className="py-4 px-6 text-right">
                    {member.role !== 'BROKER_ADMIN' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 rounded-lg text-[#6E6E7A] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove Team Member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Webhook & API Key Settings Card ── */}
      <div className="bg-[#141418] border border-white/[0.08] p-6 rounded-2xl space-y-4 shadow-xl">
        <div>
          <h2 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Key className="h-4.5 w-4.5 text-[#C9A961]" /> Organization Webhook &amp; Integration Keys
          </h2>
          <p className="text-xs text-[#9A9AA5] mt-0.5">
            Use this secret key to connect your website forms, WhatsApp Cloud API, Zillow, or Facebook Webhooks directly to your AI Lead Management workspace.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[#0D0D11] text-[#C9A961] p-4 rounded-xl border border-white/[0.08] font-mono text-xs">
          <span className="flex-1 truncate">{webhookSecret}</span>
          <button
            onClick={handleCopyWebhookSecret}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] text-xs font-semibold px-4 py-1.5 shrink-0 transition-all"
          >
            {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedKey ? 'Copied Key!' : 'Copy Secret'}
          </button>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-2xl border border-white/[0.08] p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-[#C9A961]" /> Invite Agent to Organization
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#6E6E7A] hover:text-[#F5F5F7] font-semibold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Agent Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="agent@brokerage.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-[#0D0D11] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F7] placeholder-[#6E6E7A] focus:border-[#C9A961] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#9A9AA5] mb-1">Organization Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-[#0D0D11] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-[#F5F5F7] focus:border-[#C9A961] outline-none"
                >
                  <option value="AGENT">Agent (Standard Seat)</option>
                  <option value="BROKER_ADMIN">Broker Admin (Full Access)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-full border border-white/[0.08] bg-[#0D0D11] hover:bg-white/[0.06] text-[#9A9AA5] hover:text-[#F5F5F7] px-4 py-2 text-xs font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] px-5 py-2 text-xs font-semibold transition-all"
                >
                  {sendingInvite && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Send Email Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
