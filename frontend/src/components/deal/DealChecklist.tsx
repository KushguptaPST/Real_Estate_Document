import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Deadline, NotificationSetting } from '@/types';
import {
  CheckCircle2,
  Clock,
  Mail,
  Scale,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  dealId: string;
  deadlines: Deadline[];
  notifSettings: NotificationSetting | null;
  onConfirmAll?: () => Promise<void>;
  documentCount?: number;
  onUploadClick?: () => void;
}

export function DealChecklist({
  dealId,
  deadlines,
  notifSettings,
  onConfirmAll,
  documentCount = 0,
  onUploadClick,
}: Props) {
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const totalDeadlines = deadlines.length;
  const confirmedDeadlines = deadlines.filter(
    (d) => d.status === 'CONFIRMED' || d.status === 'ACTIVE' || d.status === 'COMPLETED',
  ).length;
  const allDeadlinesConfirmed = totalDeadlines > 0 && confirmedDeadlines === totalDeadlines;

  const hasRecipients = (notifSettings?.recipients?.length ?? 0) > 0;
  const alertsEnabled = notifSettings?.enabled ?? false;

  const step1 = documentCount > 0;
  const step2 = allDeadlinesConfirmed;
  const step3 = hasRecipients && alertsEnabled;
  const step4 = totalDeadlines > 0; // AI Legal Risk & Clause Extraction is complete once deadlines are indexed

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
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* ── Stepper Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 font-mono shadow-2xs">
            {completedCount}/4
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Transaction Setup &amp; Compliance Checklist
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                {completedCount} of 4 Complete ({percentage}%)
              </span>
              {!allDeadlinesConfirmed && totalDeadlines > 0 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600" />
                  Milestone Verification Required
                </span>
              )}
              {completedCount === 4 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Fully Armed &amp; Compliant
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Lock in contingency dates, arm automated email alerts, and inspect legal risks.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 px-3 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 self-end sm:self-center cursor-pointer shadow-2xs rounded-xl shrink-0"
        >
          <span>{collapsed ? 'Expand Checklist' : 'Collapse'}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </Button>
      </div>

      {/* ── Visual Progress Track ── */}
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3.5">
        <div
          className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* ── 4 Step Cards Grid ── */}
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5 mt-3.5 border-t border-slate-100">
          {/* ── STEP 1: Contract Ingestion ── */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[148px] transition-all bg-white ${
              step1
                ? 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                : 'border-2 border-slate-900 shadow-md ring-1 ring-slate-900/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Step 1
                </span>
                {step1 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                {step1 ? 'Contract Ingested' : 'Upload Contract'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {step1
                  ? `${documentCount} agreement(s) parsed & clauses indexed.`
                  : 'Upload executed PDF agreement to compute deadlines.'}
              </p>
            </div>

            {step1 ? (
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Verified &bull; Ingested</span>
                </span>
                {onUploadClick && (
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Add Addendum &rarr;
                  </button>
                )}
              </div>
            ) : (
              <Button
                type="button"
                size="xs"
                onClick={onUploadClick}
                className="mt-3 w-full h-8 text-xs font-bold rounded-xl bg-[#0A0A0A] hover:bg-black text-white shadow-xs cursor-pointer"
              >
                Upload Document
              </Button>
            )}
          </div>

          {/* ── STEP 2: Milestone Confirmation ── */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[148px] transition-all bg-white ${
              step2
                ? 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                : 'border-2 border-slate-900 shadow-md ring-1 ring-slate-900/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      step2 ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    Step 2
                  </span>
                  {!step2 && (
                    <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded">
                      Action Required
                    </span>
                  )}
                </div>
                {step2 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                {step2 ? 'Deadlines Confirmed' : 'Confirm Deadlines'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {confirmedDeadlines} of {totalDeadlines} milestones verified.
              </p>
            </div>

            {!step2 && onConfirmAll ? (
              <Button
                type="button"
                size="xs"
                onClick={handleConfirmAllClick}
                disabled={confirmingAll}
                className="mt-3 w-full h-8 text-xs font-bold rounded-xl bg-[#0A0A0A] hover:bg-black text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {confirmingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span>Confirm All ({totalDeadlines - confirmedDeadlines})</span>
              </Button>
            ) : (
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>All Dates Locked</span>
                </span>
                <Link
                  to={`/deals/${dealId}/review`}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Review &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* ── STEP 3: Automated Alerts ── */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[148px] transition-all bg-white ${
              step3
                ? 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                : 'border-2 border-slate-900 shadow-md ring-1 ring-slate-900/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Step 3
                </span>
                {step3 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <Mail className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                {step3 ? 'Alerts Armed' : 'Configure Alerts'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {hasRecipients
                  ? `${notifSettings?.recipients?.length} recipient(s) monitoring.`
                  : 'Add Agent & TC email for 3d/1d reminders.'}
              </p>
            </div>

            {step3 ? (
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Monitoring Active</span>
                </span>
                <Link
                  to={`/deals/${dealId}/notifications`}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Settings &rarr;
                </Link>
              </div>
            ) : (
              <Link
                to={`/deals/${dealId}/notifications`}
                className="mt-3 w-full h-8 flex items-center justify-center text-xs font-bold rounded-xl bg-[#0A0A0A] hover:bg-black text-white shadow-xs transition-colors"
              >
                Add Recipients
              </Link>
            )}
          </div>

          {/* ── STEP 4: AI Legal Copilot ── */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[148px] transition-all bg-white ${
              step4
                ? 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Step 4
                </span>
                {step4 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <Scale className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                {step4 ? 'AI Legal Risk Audit' : 'Legal Review'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {step4
                  ? 'Indexed buyer remedies, HOA clauses, and risk score.'
                  : 'Inspect buyer remedies, HOA clauses, and health score.'}
              </p>
            </div>

            {step4 ? (
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>AI Audited</span>
                </span>
                <Link
                  to={`/deals/${dealId}/assistant`}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-0.5 transition-colors"
                >
                  <span>Copilot</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <Link
                to={`/deals/${dealId}/assistant`}
                className="mt-3 w-full h-8 flex items-center justify-center text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs transition-colors"
              >
                <MessageSquare className="h-3 w-3 mr-1 text-slate-500" />
                <span>Open Copilot</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
