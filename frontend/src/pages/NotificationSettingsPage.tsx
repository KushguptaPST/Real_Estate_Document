import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { dealsApi, notificationsApi } from '@/services/api';
import { useNotifications } from '@/hooks/useNotifications';
import { AlertPreferences } from '@/components/email/AlertPreferences';
import { EmailLogTable } from '@/components/email/EmailLogTable';
import { SendTestEmailButton } from '@/components/email/SendTestEmailButton';
import { EmailPreviewModal } from '@/components/email/EmailPreviewModal';
import { DealHeader } from '@/components/deal/DealHeader';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  Send,
  Mail,
  Bell,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Deal } from '@/types';

export function NotificationSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const dealId = id!;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [dealError, setDealError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);

  const {
    settings,
    logs,
    inboundInfo,
    loading,
    saving,
    error,
    successMessage,
    updateSettings,
    refreshLogs,
  } = useNotifications(dealId);

  useEffect(() => {
    dealsApi
      .get(dealId)
      .then(setDeal)
      .catch((err: Error) => setDealError(err.message));
  }, [dealId]);

  const handleSendSummary = async () => {
    if (!settings?.recipients || settings.recipients.length === 0) {
      alert('Please add at least one alert recipient in settings before sending the summary.');
      return;
    }
    setSendingSummary(true);
    setSummaryStatus(null);
    try {
      await notificationsApi.sendSummaryEmail(dealId, settings.recipients);
      setSummaryStatus('Deal summary email dispatched via Resend to all recipients.');
      refreshLogs();
      setTimeout(() => setSummaryStatus(null), 4000);
    } catch (err) {
      alert(`Failed to send summary: ${(err as Error).message}`);
    } finally {
      setSendingSummary(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Unified Command Center Header & Tab Navigation */}
      <DealHeader deal={deal} notifSettings={settings} activeTab="notifications" />

      {/* Page Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary font-mono">
              Delivery Orchestration
            </span>
            <Badge variant="success" className="text-[10px]">
              Resend Verified
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Email Alerts &amp; Milestone Reminders
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configure automated milestone reminders, preview dynamic templates, and inspect cryptographic delivery logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Preview Templates</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendSummary}
            disabled={sendingSummary}
            className="gap-1.5 h-8 text-xs"
          >
            {sendingSummary ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Send className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>Send Summary Now</span>
          </Button>

          <SendTestEmailButton
            dealId={dealId}
            defaultRecipient={settings?.recipients[0] ?? ''}
            onSent={refreshLogs}
          />
        </div>
      </div>

      {dealError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{dealError}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {summaryStatus && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-50/80 dark:bg-blue-950/40 p-4 text-xs text-blue-800 dark:text-blue-300">
          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{summaryStatus}</span>
        </div>
      )}

      {/* Preferences Form */}
      {loading ? (
        <div className="rounded-xl border border-border/70 bg-card p-12 flex items-center justify-center gap-2 text-xs text-muted-foreground shadow-2xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading alert preferences...</span>
        </div>
      ) : (
        <AlertPreferences
          settings={settings}
          saving={saving}
          onSave={updateSettings}
        />
      )}

      {/* Delivery Log Table */}
      <EmailLogTable logs={logs} loading={loading} onRefresh={refreshLogs} />

      {/* Preview Modal */}
      <EmailPreviewModal
        dealId={dealId}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
