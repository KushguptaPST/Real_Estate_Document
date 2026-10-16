import type { EmailLog } from '@/types';
import { formatAuditTimestamp } from '@/utils/date';
import { Mail, RotateCw, CheckCircle2, Send, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Props {
  logs: EmailLog[];
  loading?: boolean;
  onRefresh?: () => void;
}

const TEMPLATE_NAMES: Record<string, string> = {
  '3d': '3-Day Prior Reminder',
  '1d': '1-Day Urgent Notice',
  'dayOf': 'Day-Of Expiration',
  'missed': 'Past Due Breach Notice',
  'summary': 'Executive Deal Brief',
  'docs_received': 'Contract Received Notice',
};

function StatusBadge({ status, error }: { status: EmailLog['status']; error?: string | null }) {
  switch (status) {
    case 'DELIVERED':
      return (
        <Badge variant="success" className="gap-1 text-[11px] font-medium">
          <CheckCircle2 className="h-3 w-3" />
          <span>Delivered</span>
        </Badge>
      );
    case 'SENT':
      return (
        <Badge variant="info" className="gap-1 text-[11px] font-medium">
          <Send className="h-3 w-3" />
          <span>Dispatched</span>
        </Badge>
      );
    case 'BOUNCED':
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant="destructive" className="gap-1 text-[11px] font-medium cursor-help" title={error || 'Email bounced'}>
            <XCircle className="h-3 w-3" />
            <span>Bounced</span>
          </Badge>
          {error && (
            <span className="text-[10px] text-rose-400 line-clamp-1 max-w-[220px]" title={error}>
              {error}
            </span>
          )}
        </div>
      );
    case 'DROPPED':
      return (
        <Badge variant="warning" className="gap-1 text-[11px] font-medium">
          <AlertTriangle className="h-3 w-3" />
          <span>Dropped</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className="gap-1 text-[11px] font-medium">
          <Clock className="h-3 w-3" />
          <span>{status}</span>
        </Badge>
      );
  }
}

export function EmailLogTable({ logs, loading, onRefresh }: Props) {
  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Email Dispatch Audit Log
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cryptographically tracked delivery log for all compliance notices sent via Resend API.
          </p>
        </div>
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-2.5 text-xs gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground border border-border/60 mb-3">
            <Mail className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No email alerts dispatched yet</h4>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            When contingency deadlines trigger their reminder windows, full audit delivery logs will be recorded here.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Recipient</TableHead>
              <TableHead className="w-[25%]">Notice Type</TableHead>
              <TableHead className="w-[20%]">Associated Milestone</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="text-right">Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs font-medium text-foreground">
                  {log.recipient}
                </TableCell>
                <TableCell className="text-xs text-foreground font-medium">
                  {TEMPLATE_NAMES[log.template] ?? log.template}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.deadline?.label ?? 'General Transaction Notice'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.status} error={log.errorMessage} />
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {formatAuditTimestamp(log.sentAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
