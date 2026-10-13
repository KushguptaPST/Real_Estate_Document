import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Deadline, NotificationSetting } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  Mail,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface Props {
  dealId: string;
  deadlines: Deadline[];
  notifSettings: NotificationSetting | null;
  onConfirmAll?: () => Promise<void>;
}

export function DealChecklist({ dealId, deadlines, notifSettings, onConfirmAll }: Props) {
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const totalDeadlines = deadlines.length;
  const confirmedDeadlines = deadlines.filter(
    (d) => d.status === 'CONFIRMED' || d.status === 'ACTIVE' || d.status === 'COMPLETED',
  ).length;
  const allDeadlinesConfirmed = totalDeadlines > 0 && confirmedDeadlines === totalDeadlines;

  const hasRecipients = (notifSettings?.recipients?.length ?? 0) > 0;
  const alertsEnabled = notifSettings?.enabled ?? false;

  const step1 = true;
  const step2 = allDeadlinesConfirmed;
  const step3 = hasRecipients && alertsEnabled;
  const step4 = totalDeadlines > 0;

  const completedCount = [step1, step2, step3, step4].filter(Boolean).length;
  const percentage = Math.round((completedCount / 4) * 100);

  const handleConfirmAllClick = async () => {
    if (!onConfirmAll) return;
    setConfirmingAll(true);
    try {
      await onConfirmAll();
    } finally {
      setConfirmingAll(false);
    }
  };

  return (
    <div className="bg-[#141418] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-xl bg-[#C9A961]/15 text-[#C9A961] font-bold text-xs border border-[#C9A961]/25">
            {completedCount}/4
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#F5F5F7] tracking-tight">
                Transaction Setup &amp; Compliance Stepper
              </h3>
              <Badge variant={percentage === 100 ? 'success' : 'neutral'} className="text-[10px] bg-[#34D399]/15 text-[#34D399] border-[#34D399]/25">
                {percentage}% Ready
              </Badge>
            </div>
            <p className="text-[11px] text-[#9A9AA5] mt-0.5">
              Lock in contingency dates, arm automated email alerts, and inspect legal risks.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9A9AA5] hover:text-[#F5F5F7] self-end sm:self-center cursor-pointer transition-colors"
        >
          <span>{collapsed ? 'Expand Checklist' : 'Collapse'}</span>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5">
          {/* Step 1: Upload */}
          <div className="bg-[#0D0D11] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#C9A961]/30 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E7A]">Step 1</span>
                <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
              </div>
              <h4 className="text-xs font-semibold text-[#F5F5F7] mt-1">Contract Ingested</h4>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                PDF parsed, text indexed, and clauses identified by AI.
              </p>
            </div>
            <span className="mt-3 text-[10px] font-medium text-[#34D399] flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Verified &bull; Ingested</span>
            </span>
          </div>

          {/* Step 2: Milestone Confirmation */}
          <div
            className={`bg-[#0D0D11] border rounded-xl p-3.5 flex flex-col justify-between transition-all ${
              step2 ? 'border-white/[0.08] hover:border-[#C9A961]/30' : 'border-[#C9A961]/30 bg-[#C9A961]/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    step2 ? 'text-[#6E6E7A]' : 'text-[#C9A961]'
                  }`}
                >
                  Step 2
                </span>
                {step2 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-[#C9A961]" />
                )}
              </div>
              <h4 className="text-xs font-semibold text-[#F5F5F7] mt-1">
                {step2 ? 'Deadlines Confirmed' : 'Confirm Deadlines'}
              </h4>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                {confirmedDeadlines} of {totalDeadlines} milestones verified.
              </p>
            </div>

            {!step2 && onConfirmAll ? (
              <Button
                variant="default"
                size="xs"
                onClick={handleConfirmAllClick}
                disabled={confirmingAll}
                className="mt-3 w-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold rounded-full"
              >
                {confirmingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                <span>Confirm All ({totalDeadlines - confirmedDeadlines})</span>
              </Button>
            ) : (
              <span className="mt-3 text-[10px] font-medium text-[#34D399] flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>All Dates Locked</span>
              </span>
            )}
          </div>

          {/* Step 3: Alerts Setup */}
          <div className="bg-[#0D0D11] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#C9A961]/30 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E7A]">Step 3</span>
                {step3 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                ) : (
                  <Mail className="h-4 w-4 text-[#6E6E7A]" />
                )}
              </div>
              <h4 className="text-xs font-semibold text-[#F5F5F7] mt-1">
                {step3 ? 'Alerts Armed' : 'Configure Alerts'}
              </h4>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                {hasRecipients
                  ? `${notifSettings?.recipients?.length} recipient(s) monitoring.`
                  : 'Add Agent &amp; TC email for 3d/1d reminders.'}
              </p>
            </div>

            <Link
              to={`/deals/${dealId}/notifications`}
              className="mt-3 text-[10px] font-semibold text-[#C9A961] hover:text-[#D4B774] inline-flex items-center gap-1 transition-colors"
            >
              <span>{step3 ? 'Manage Settings' : 'Add Recipients'}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Step 4: AI Legal Copilot */}
          <div className="bg-[#0D0D11] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#C9A961]/30 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E7A]">Step 4</span>
                <Sparkles className="h-4 w-4 text-[#C9A961]" />
              </div>
              <h4 className="text-xs font-semibold text-[#F5F5F7] mt-1">AI Legal Review</h4>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                Inspect buyer remedies, HOA clauses, and health score.
              </p>
            </div>

            <Link
              to={`/deals/${dealId}/assistant`}
              className="mt-3 rounded-full border border-white/[0.08] bg-[#141418] hover:bg-white/[0.06] text-[#F5F5F7] text-[10px] py-1 px-3 flex items-center justify-center gap-1 transition-all"
            >
              <Sparkles className="h-3 w-3 text-[#C9A961]" />
              <span>Open AI Copilot</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
