import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  CheckCircle2,
  Loader2,
  Trash2,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { organizationApi } from '@/services/api';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [showInviteModal, setShowInviteModal] = useState(false);

  // Auto-open invite modal if query param is present
  useEffect(() => {
    if (searchParams.get('invite') === 'true') {
      setShowInviteModal(true);
    }
  }, [searchParams]);

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteSuccessData(null);
    setInviteError(null);
    if (searchParams.get('invite')) {
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      setSearchParams(next, { replace: true });
    }
  };

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

  const orgName = user?.organizationName || 'Eigen Estate';

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

  // Team Members & Invitations State (seeded immediately from SWR cache when available)
  const [loadingMembers, setLoadingMembers] = useState(() => !organizationApi.getCachedMembers());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const cachedMembers = organizationApi.getCachedMembers();
    if (!cachedMembers) return [];
    const list: TeamMember[] = cachedMembers.map((m) => ({
      id: m.id,
      name: m.name || m.email.split('@')[0],
      email: m.email,
      role: m.role as 'OWNER' | 'AGENT',
      status: 'ACTIVE',
      joinedAt: m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '2026-01-15',
      isInvite: false,
    }));
    const cachedInvites = organizationApi.getCachedInvitations();
    if (cachedInvites) {
      cachedInvites
        .filter((inv) => inv.status === 'PENDING')
        .forEach((inv) => {
          list.push({
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
    return list;
  });

  const fetchMembersAndInvites = useCallback(async () => {
    const hasWarmCache = Boolean(organizationApi.getCachedMembers());
    try {
      if (!hasWarmCache) setLoadingMembers(true);
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

  function handleCopyInviteUrl() {
    if (inviteSuccessData?.inviteUrl) {
      navigator.clipboard.writeText(inviteSuccessData.inviteUrl);
      setCopiedInviteUrl(true);
      toast.success('One-time invitation URL copied to clipboard');
      setTimeout(() => setCopiedInviteUrl(false), 2000);
    }
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

      if (res.emailSent) {
        toast.success(`Invitation email sent to ${inviteEmail.trim()}`);
      } else {
        toast.warning(
          `Invite link created, but email could not be sent (${res.emailError || 'sender unverified'}). Share the backup link directly.`,
        );
      }
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
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      fetchMembersAndInvites();
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
              Manage licensed agents and role-based access control for your brokerage workspace.
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

      {/* ── Team Roster & Roles ── */}
      <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-emerald-700" /> Team Roster &amp; Member Roles
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Licensed agents and brokerage managers operating within this organization.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Tenant Isolated
                </span>
                {user?.role === "OWNER" && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Invite Agent</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              {loadingMembers ? (
                <div className="p-4">
                  <TableRowsSkeleton rows={4} compact />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Users className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-800">No team members registered yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Invite licensed agents and transaction coordinators to collaborate on deals and AI voice pipelines.
                  </p>
                  {user?.role === "OWNER" && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Invite First Team Member</span>
                    </button>
                  )}
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
                          {user?.role === "OWNER" && !member.isInvite && member.id !== user.id ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value as "OWNER" | "AGENT")}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-900 cursor-pointer"
                            >
                              <option value="AGENT">Real Estate Advisor</option>
                              <option value="OWNER">Broker Admin</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                                member.role === "OWNER"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {member.role === "OWNER" ? "Broker Admin" : "Agent"}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              member.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-slate-500 font-mono">{member.joinedAt}</td>
                        <td className="py-3.5 px-6 text-right">
                          {user?.role === "OWNER" && member.id !== user.id && (
                            <button
                              onClick={() => promptRemoveMember(member.id, member.isInvite)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title={member.isInvite ? "Revoke Invitation" : "Remove Team Member"}
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
        </div>

      {/* ── Invite Modal ── */}
      {showInviteModal &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseInviteModal();
            }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in duration-150 select-text"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <UserPlus className="h-4.5 w-4.5 text-emerald-700" /> Invite Agent to Workspace
                </h3>
                <button
                  onClick={handleCloseInviteModal}
                  className="text-slate-400 hover:text-slate-600 font-semibold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {inviteSuccessData ? (
                <div className="space-y-4">
                  {inviteSuccessData.emailSent ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                      <p className="font-semibold mb-1">
                        Invitation email sent to {inviteSuccessData.email}
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Your advisor can click the Accept button in their inbox, or use this one-time backup link:
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <p className="font-semibold mb-1">
                        Invite link created for {inviteSuccessData.email} (email not delivered)
                      </p>
                      <p className="text-[11px] text-amber-800">
                        {inviteSuccessData.emailError || 'Verify your sending domain in Resend / SMTP to send directly to external advisors.'} Share this one-time link manually for now:
                      </p>
                    </div>
                  )}

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
                      onClick={handleCloseInviteModal}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={handleSendInvite} className="space-y-4">
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
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (inviteError) setInviteError(null);
                      }}
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
                      onClick={handleCloseInviteModal}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingInvite}
                      className="px-5 py-2 bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {sendingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      <span>{sendingInvite ? 'Sending Email...' : 'Send Invite Email'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
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
