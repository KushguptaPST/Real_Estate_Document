import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDeadlines } from '@/hooks/useDeadlines';
import { deadlinesApi, dealsApi } from '@/services/api';
import { DeadlineCard } from '@/components/DeadlineCard';
import { DealHeader } from '@/components/deal/DealHeader';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCheck2,
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Deadline, Deal, NotificationSetting } from '@/types';
import { notificationsApi } from '@/services/api';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const dealId = id!;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotificationSetting | null>(null);
  const { deadlines, loading, error, refetch } = useDeadlines(dealId);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    dealsApi
      .get(dealId)
      .then(setDeal)
      .catch(() => {});

    notificationsApi
      .getSettings(dealId)
      .then(setNotifSettings)
      .catch(() => {});
  }, [dealId]);

  // Quick-confirm with the computed date as-is
  async function handleConfirm(deadline: Deadline) {
    setConfirming(deadline.id);
    setConfirmError(null);
    try {
      await deadlinesApi.confirm(dealId, deadline.id, {
        confirmedDate: deadline.computedDate,
        activate: true,
      });
      refetch();
    } catch (err) {
      setConfirmError((err as Error).message);
    } finally {
      setConfirming(null);
    }
  }

  const pending = deadlines.filter((d) => d.status === 'PENDING');
  const confirmed = deadlines.filter((d) => d.status !== 'PENDING');

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Unified Command Center Header & Tab Navigation */}
      <DealHeader deal={deal} notifSettings={notifSettings} activeTab="documents" />

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary font-mono">
            Compliance Audit
          </span>
          <Badge variant="neutral" className="text-[10px]">
            {deadlines.length} Clauses Extracted
          </Badge>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Clause &amp; Deadline Verification
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Audit each AI-extracted contingency against exact verbatim contract citations. Adjust target dates or confirm to arm automated reminders.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-border/70 bg-card p-12 flex items-center justify-center gap-2 text-xs text-muted-foreground shadow-2xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading extracted contract clauses...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {confirmError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{confirmError}</span>
        </div>
      )}

      {/* Pending — need user action */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Requires Agent Confirmation ({pending.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {pending.map((dl) => (
              <div key={dl.id} className={confirming === dl.id ? 'pointer-events-none opacity-50' : ''}>
                <DeadlineCard deadline={dl} onConfirm={(d) => void handleConfirm(d)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirmed / Active */}
      {confirmed.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Agent Confirmed Milestones ({confirmed.length})</span>
          </h2>
          <div className="space-y-3">
            {confirmed.map((dl) => (
              <DeadlineCard key={dl.id} deadline={dl} />
            ))}
          </div>
        </section>
      )}

      {!loading && deadlines.length === 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-12 text-center text-xs text-muted-foreground shadow-2xs">
          No deadlines extracted yet. Upload a contract PDF to begin extraction.
        </div>
      )}

      <div className="pt-4 flex items-center justify-between border-t border-border/60">
        <Button asChild variant="secondary" size="sm" className="gap-1 text-xs">
          <Link to={`/deals/${dealId}`}>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back to Milestones</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1 text-xs">
          <Link to={`/audit?dealId=${dealId}`}>
            <span>Audit Trail</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
