import { useState, useEffect } from 'react';
import type { NotificationSetting, UpdateNotificationSettingsInput } from '@/types';
import { Plus, Check, Clock, Bell, Globe, Mail, X, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Props {
  settings: NotificationSetting | null;
  saving: boolean;
  onSave: (data: UpdateNotificationSettingsInput) => Promise<unknown>;
}

const COMMON_TIMEZONES = [
  { label: 'Eastern Time (US & Canada)', value: 'America/New_York' },
  { label: 'Central Time (US & Canada)', value: 'America/Chicago' },
  { label: 'Mountain Time (US & Canada)', value: 'America/Denver' },
  { label: 'Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
  { label: 'Alaska Time', value: 'America/Anchorage' },
  { label: 'Hawaii-Aleutian Time', value: 'Pacific/Honolulu' },
  { label: 'UTC', value: 'UTC' },
];

function extractEmails(text: string): string[] {
  const regex = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
}

export function AlertPreferences({ settings, saving, onSave }: Props) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);
  const [timezone, setTimezone] = useState(settings?.timezone ?? 'America/New_York');
  const [recipients, setRecipients] = useState<string[]>(settings?.recipients ?? []);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recipientFeedback, setRecipientFeedback] = useState<string | null>(null);
  const [isPersistingRecipient, setIsPersistingRecipient] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [windows, setWindows] = useState({
    d3: settings?.window3d ?? true,
    d1: settings?.window1d ?? true,
    dayOf: settings?.windowDayOf ?? true,
    missed: settings?.windowMissed ?? true,
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setTimezone(settings.timezone || 'America/New_York');
      setRecipients(settings.recipients || []);
      setWindows({
        d3: settings.window3d,
        d1: settings.window1d,
        dayOf: settings.windowDayOf,
        missed: settings.windowMissed,
      });
    }
  }, [settings]);

  const persistRecipientList = async (nextList: string[], feedbackMsg: string) => {
    setIsPersistingRecipient(true);
    setRecipientFeedback(null);
    setEmailError(null);
    try {
      await onSave({
        enabled,
        timezone,
        recipients: nextList,
        windows,
      });
      setRecipientFeedback(feedbackMsg);
      setTimeout(() => setRecipientFeedback(null), 3500);
    } catch (err) {
      if (settings?.recipients) {
        setRecipients(settings.recipients);
      }
      setEmailError(err instanceof Error ? err.message : 'Failed to save recipient update to server.');
    } finally {
      setIsPersistingRecipient(false);
    }
  };

  const handleAddRecipient = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = newEmail.trim();
    if (!raw) return;

    const extracted = extractEmails(raw);
    if (extracted.length === 0) {
      setEmailError('Please enter a valid email address (e.g. escrow@titlecompany.com).');
      return;
    }

    const newOnes = extracted.filter((addr) => !recipients.includes(addr));
    if (newOnes.length === 0) {
      setEmailError(
        extracted.length === 1
          ? `"${extracted[0]}" is already in the recipient list.`
          : 'All entered email addresses are already in the recipient list.'
      );
      return;
    }

    const nextRecipients = [...recipients, ...newOnes];
    setRecipients(nextRecipients);
    setNewEmail('');
    setEmailError(null);

    const feedbackMsg =
      newOnes.length === 1
        ? `Added & saved ${newOnes[0]}`
        : `Added & saved ${newOnes.length} recipients`;

    await persistRecipientList(nextRecipients, feedbackMsg);
  };

  const handleRemoveRecipient = async (emailToRemove: string) => {
    const nextRecipients = recipients.filter((r) => r !== emailToRemove);
    setRecipients(nextRecipients);
    await persistRecipientList(nextRecipients, `Removed ${emailToRemove}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);
    setEmailError(null);

    // If user typed an email into the input but clicked the bottom save button
    let finalRecipients = [...recipients];
    if (newEmail.trim()) {
      const pending = extractEmails(newEmail.trim());
      const additions = pending.filter((addr) => !finalRecipients.includes(addr));
      if (additions.length > 0) {
        finalRecipients = [...finalRecipients, ...additions];
        setRecipients(finalRecipients);
        setNewEmail('');
      }
    }

    try {
      await onSave({
        enabled,
        timezone,
        recipients: finalRecipients,
        windows,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch {
      // Error handled by parent toast or error boundary
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border/70 bg-card p-6 shadow-sm space-y-6">
      {/* Header Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">Automated Email Alerts</h3>
            <Badge variant={enabled ? 'success' : 'neutral'} className="text-[10px]">
              {enabled ? 'Active Engine' : 'Paused'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground pl-10">
            Precision contingency reminders dispatched via Resend to agents, clients, and transaction coordinators.
          </p>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-xs"></div>
        </label>
      </div>

      {/* Recipient Management */}
      <div className="space-y-3 pb-6 border-b border-border/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-[#C9A961]" />
            Alert Distribution List
          </label>
          <div className="flex items-center gap-2">
            {recipientFeedback && (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 animate-fadeIn">
                <Check className="h-3 w-3" />
                {recipientFeedback}
              </span>
            )}
            <Badge variant="neutral" className="text-[11px] font-mono bg-[#181820] border-white/10 text-muted-foreground">
              {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'} configured
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              autoComplete="email"
              spellCheck={false}
              placeholder="e.g. escrow@titlecompany.com, agent@brokerage.com"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRecipient();
                }
              }}
              className="h-9.5 text-xs pl-3 bg-[#101014] border-white/10 text-[#F5F5F7] placeholder-[#5E5E6C] focus-visible:border-[#C9A961]/70"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!newEmail.trim() || isPersistingRecipient}
            onClick={() => handleAddRecipient()}
            className="h-9.5 px-3.5 text-xs gap-1.5 shrink-0 bg-[#1A1A22] text-[#F5F5F7] border border-white/10 hover:border-[#C9A961]/40 hover:bg-[#22222C]"
          >
            {isPersistingRecipient ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A961]" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 text-[#C9A961]" />
                <span>Add Recipient</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Press Enter or click Add Recipient. Supports single or multiple comma/semicolon-separated addresses.</span>
        </div>

        {emailError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 animate-fadeIn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{emailError}</span>
          </div>
        )}

        {recipients.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#181820] border border-white/10 px-2.5 py-1 text-xs font-mono text-[#F5F5F7] shadow-xs group hover:border-[#C9A961]/40 transition-all"
              >
                <Mail className="h-3 w-3 text-[#C9A961]" />
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email)}
                  disabled={isPersistingRecipient}
                  className="text-muted-foreground hover:text-rose-400 transition-colors ml-1 p-0.5 rounded cursor-pointer disabled:opacity-50"
                  aria-label={`Remove ${email}`}
                  title="Remove recipient"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/80 italic py-1">
            No recipients configured yet. Add at least one email address to receive automated notifications.
          </p>
        )}
      </div>

      {/* Notification Windows */}
      <div className="space-y-3 pb-6 border-b border-border/60">
        <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Trigger Windows (Confirmed Milestones Only)
        </label>
        <p className="text-xs text-muted-foreground">
          Alerts are automatically timed to give all parties sufficient runway before earnest money deposits or contingencies lapse.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${windows.d3 ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/60 bg-muted/20 opacity-70'}`}>
            <input
              type="checkbox"
              checked={windows.d3}
              onChange={(e) => setWindows({ ...windows, d3: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">3 Days Prior (T-3)</span>
              <p className="text-[11px] text-muted-foreground">Early warning notice for document collection and scheduling.</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${windows.d1 ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/60 bg-muted/20 opacity-70'}`}>
            <input
              type="checkbox"
              checked={windows.d1}
              onChange={(e) => setWindows({ ...windows, d1: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">1 Day Prior (T-1)</span>
              <p className="text-[11px] text-muted-foreground">Critical high-priority reminder before midnight deadline cutoff.</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${windows.dayOf ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/60 bg-muted/20 opacity-70'}`}>
            <input
              type="checkbox"
              checked={windows.dayOf}
              onChange={(e) => setWindows({ ...windows, dayOf: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Day-of Expiration (T-0)</span>
              <p className="text-[11px] text-muted-foreground">Morning execution notice sent at 9:00 AM local property time.</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${windows.missed ? 'border-destructive/40 bg-destructive/[0.02]' : 'border-border/60 bg-muted/20 opacity-70'}`}>
            <input
              type="checkbox"
              checked={windows.missed}
              onChange={(e) => setWindows({ ...windows, missed: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-border text-destructive focus:ring-destructive/30"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-destructive">Past Due / Lapse Escalation</span>
              <p className="text-[11px] text-muted-foreground">Urgent breach notice if contingency remains unconfirmed after deadline.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Timezone Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          Jurisdiction & Deal Timezone
        </label>
        <p className="text-xs text-muted-foreground">
          All deadline calculations and automated email dispatches are synced to this local timezone.
        </p>
        <div className="max-w-md">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-9.5 w-full rounded-xl border border-white/10 bg-[#101014] px-3 py-1.5 text-xs text-[#F5F5F7] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A961]/40 focus-visible:border-[#C9A961]/70 shadow-xs"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[#141418] text-[#F5F5F7]">
                {tz.label} ({tz.value})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Submit Button & Confirmation */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-[#C9A961]" />
          <span>Encrypted webhook delivery via Resend Enterprise</span>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>All preferences saved</span>
            </span>
          )}
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 h-9 px-4 text-xs font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Save Alert Preferences</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
