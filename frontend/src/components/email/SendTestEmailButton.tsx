import { useState } from 'react';
import { notificationsApi } from '@/services/api';
import { Send, Loader2, CheckCircle2, AlertCircle, X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  dealId: string;
  defaultRecipient?: string;
  onSent?: () => void;
}

export function SendTestEmailButton({ dealId, defaultRecipient = '', onSent }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(defaultRecipient);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus({ type: 'error', message: 'Please enter a valid recipient email.' });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await notificationsApi.sendTestEmail(dealId, email.trim());
      setStatus({ type: 'success', message: res.message || 'Test alert dispatched via Resend.' });
      onSent?.();
      setTimeout(() => {
        setIsOpen(false);
        setStatus(null);
      }, 2500);
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEmail(defaultRecipient);
            setIsOpen(true);
          }}
          className="h-8 px-2.5 text-xs gap-1.5"
        >
          <Send className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Send Test Alert</span>
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-0 z-30 w-84 rounded-xl border border-border/80 bg-popover p-4 shadow-xl text-popover-foreground"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold text-foreground">Dispatch Test Alert</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSend} className="space-y-3 pt-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  placeholder="agent@brokerage.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>

              {status && (
                <div
                  className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                    status.type === 'success'
                      ? 'border border-emerald-500/20 bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border border-destructive/20 bg-destructive/10 text-destructive'
                  }`}
                >
                  {status.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <span className="text-[11px] leading-tight">{status.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  size="xs"
                  className="gap-1 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      <span>Dispatch</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
