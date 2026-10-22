import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dealsApi, auditApi, notificationsApi } from '@/services/api';
import { useDeadlines } from '@/hooks/useDeadlines';
import { Timeline } from '@/components/Timeline';
import { ActivityHistory } from '@/components/ActivityHistory';
import { DealHeader } from '@/components/deal/DealHeader';
import { DealChecklist } from '@/components/deal/DealChecklist';
import { TransactionTaskPanel } from '@/components/deal/TransactionTaskPanel';
import { UploadZone } from '@/components/UploadZone';
import {
  ChevronRight,
  AlertTriangle,
  Loader2,
  Mail,
  CheckCircle2,
  Send,
  SlidersHorizontal,
  History,
  Clock,
  Sparkles,
  ShieldCheck,
  FileText,
  UploadCloud,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Deal, AuditLog, NotificationSetting, Deadline } from '@/types';

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dealId = id!;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [dealError, setDealError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotificationSetting | null>(null);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [showUploadZone, setShowUploadZone] = useState(false);

  const { deadlines, loading, error, confirmDeadline, refetch } = useDeadlines(dealId);

  useEffect(() => {
    dealsApi
      .get(dealId)
      .then(setDeal)
      .catch((err: Error) => setDealError(err.message));

    notificationsApi
      .getSettings(dealId)
      .then(setNotifSettings)
      .catch(() => {});

    setAuditLoading(true);
    auditApi
      .list(dealId)
      .then((res) => setAuditLogs(res.data))
      .catch((err: Error) => setAuditError(err.message))
      .finally(() => setAuditLoading(false));
  }, [dealId]);

  const handleConfirmAll = async () => {
    const unverifiedDeadlines = deadlines.filter(
      (d) => d.status !== 'CONFIRMED' && d.status !== 'ACTIVE' && d.status !== 'COMPLETED',
    );
    if (unverifiedDeadlines.length === 0) return;

    await Promise.all(
      unverifiedDeadlines.map((d) => {
        const targetDate = d.confirmedDate || d.computedDate || new Date().toISOString();
        return confirmDeadline(d.id, {
          confirmedDate: new Date(targetDate).toISOString(),
          activate: true,
        });
      }),
    );
    refetch();
    // Refresh deal & notifications
    notificationsApi.getSettings(dealId).then(setNotifSettings).catch(() => {});
  };

  const handleConfirmSingleDeadline = async (deadline: Deadline) => {
    try {
      const targetDate = deadline.confirmedDate || deadline.computedDate || new Date().toISOString();
      await confirmDeadline(deadline.id, {
        confirmedDate: new Date(targetDate).toISOString(),
        activate: true,
      });
      refetch();
    } catch (err) {
      alert(`Failed to confirm deadline: ${(err as Error).message}`);
    }
  };

  const handleSendSummary = async () => {
    if (!notifSettings?.recipients || notifSettings.recipients.length === 0) {
      alert('Please configure at least one recipient email in Notification Settings.');
      return;
    }
    setSendingSummary(true);
    setSummaryMessage(null);
    try {
      await notificationsApi.sendSummaryEmail(dealId, notifSettings.recipients);
      setSummaryMessage('Executive summary report dispatched via Resend to all configured recipients.');
      setTimeout(() => setSummaryMessage(null), 4000);
    } catch (err) {
      alert(`Failed to send summary email: ${(err as Error).message}`);
    } finally {
      setSendingSummary(false);
    }
  };

  const handleUploadSuccess = async () => {
    refetch();
    try {
      const updatedDeal = await dealsApi.get(dealId);
      setDeal(updatedDeal);
      const updatedSettings = await notificationsApi.getSettings(dealId).catch(() => null);
      if (updatedSettings) setNotifSettings(updatedSettings);
    } catch (e) {
      console.error(e);
    }
    setShowUploadZone(false);
    setSummaryMessage('Contract uploaded and processed! Contingency milestones and clauses extracted.');
    setTimeout(() => setSummaryMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto transition-opacity duration-200">
      {/* Unified Command Center Header & Tab Navigation */}
      <DealHeader deal={deal} notifSettings={notifSettings} activeTab="milestones" />

      {dealError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{dealError}</span>
        </div>
      )}

      {summaryMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{summaryMessage}</span>
        </div>
      )}

      {/* 4-Step Transaction Compliance Checklist */}
      <DealChecklist
        dealId={dealId}
        deadlines={deadlines}
        notifSettings={notifSettings}
        onConfirmAll={handleConfirmAll}
        documentCount={deal?.documents?.length ?? 0}
        onUploadClick={() => setShowUploadZone(true)}
      />

      {/* ── Deal Documents & Contract Ingestion ── */}
      <div id="deal-documents-section" className="rounded-2xl border border-white/[0.08] bg-[#141418] p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white tracking-tight uppercase">
                  Deal Contract &amp; Legal Documents
                </h3>
                <Badge variant={(deal?.documents?.length ?? 0) > 0 ? 'success' : 'warning'} className="text-[10px]">
                  {(deal?.documents?.length ?? 0) > 0
                    ? `${deal?.documents?.length} Ingested`
                    : 'Action Required: No Contract Uploaded'}
                </Badge>
              </div>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                {(deal?.documents?.length ?? 0) > 0
                  ? 'Executed agreements, counter-offers, and addenda indexed by the AI contingency parser.'
                  : 'Upload your purchase agreement PDF to compute binding contingency milestones and alert triggers.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUploadZone(!showUploadZone)}
              className="h-8 px-3 text-xs gap-1.5 border-white/[0.08] text-[#D1D1DB] hover:bg-white/5 cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5 text-[#C9A961]" />
              <span>{showUploadZone ? 'Close Upload' : '+ Upload Agreement / Addendum'}</span>
            </Button>
          </div>
        </div>

        {/* Upload Zone (Visible when 0 documents, or when toggled) */}
        {(showUploadZone || (deal?.documents?.length ?? 0) === 0) && (
          <div className="pt-1">
            <UploadZone
              dealId={dealId}
              onSuccess={handleUploadSuccess}
            />
          </div>
        )}

        {/* Existing Documents Grid */}
        {(deal?.documents?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {deal?.documents?.map((doc: any) => (
              <div
                key={doc.id}
                className="bg-[#0D0D11] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between hover:border-[#C9A961]/30 transition-all"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-white truncate max-w-[160px]" title={doc.fileName}>
                      {doc.fileName}
                    </div>
                    <div className="text-[10px] text-[#9A9AA5]">
                      {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB • ` : ''}
                      {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <Link
                  to={`/deals/${dealId}/review`}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#C9A961] bg-[#C9A961]/10 hover:bg-[#C9A961]/20 transition-colors shrink-0"
                >
                  Clauses
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Automated Email Alerts Dispatch Bar */}
      <div className="rounded-xl border border-border/70 bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground tracking-tight">
                Automated Deadline Alerts (Resend Engine)
              </h3>
              <Badge variant={notifSettings?.enabled ? 'success' : 'neutral'} className="text-[10px]">
                {notifSettings?.enabled ? 'Armed' : 'Standby'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {notifSettings?.enabled && (notifSettings.recipients?.length ?? 0) > 0
                ? `${notifSettings.recipients.length} configured recipient(s) &bull; Alerts dispatch at T-3, T-1, and 9:00 AM day-of milestone.`
                : 'Alerts require at least one recipient email to trigger automated notifications.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendSummary}
            disabled={sendingSummary}
            className="h-8 px-3 text-xs gap-1.5"
          >
            {sendingSummary ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Send className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>Send Summary Now</span>
          </Button>

          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-8 px-3 text-xs gap-1"
          >
            <Link to={`/deals/${dealId}/notifications`}>
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Configure Alerts</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Deadline Timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground tracking-tight uppercase tracking-wider">
                Contingency Milestone Schedule
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deterministic deadlines calculated from contract mutual acceptance date and jurisdiction rules.
            </p>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-border/70 bg-card flex items-center justify-center gap-2 py-14 text-xs text-muted-foreground shadow-2xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Computing contract timeline milestones...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && <Timeline deadlines={deadlines} onConfirm={handleConfirmSingleDeadline} />}
      </section>

      {/* Non-Contingency Transaction Obligations Tasks */}
      <section className="pt-2">
        <TransactionTaskPanel dealId={dealId} documents={deal?.documents || []} />
      </section>

      {/* Activity History / Immutable Audit Trail */}
      <section className="pt-2">
        <ActivityHistory
          logs={auditLogs}
          loading={auditLoading}
          error={auditError}
          initialLimit={5}
        />
      </section>

      {/* Full Audit Link */}
      <div className="text-right pb-4">
        <Link
          to={`/audit?dealId=${dealId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <History className="h-3.5 w-3.5" />
          <span>View complete tamper-evident audit history</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
