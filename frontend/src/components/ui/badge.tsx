import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' | 'neutral' | 'gold';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition-colors select-none';

  const variants = {
    default: 'border border-white/10 bg-[#1A1A22] text-[#F5F5F7]',
    gold: 'border border-[#C9A961]/30 bg-[#C9A961]/10 text-[#C9A961]',
    secondary: 'border border-white/5 bg-white/5 text-[#9A9AA5]',
    outline: 'border border-white/15 text-[#F5F5F7] bg-transparent',
    destructive: 'border border-rose-500/25 bg-rose-500/10 text-rose-300',
    success: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    warning: 'border border-amber-500/25 bg-amber-500/10 text-amber-400',
    info: 'border border-[#C9A961]/25 bg-[#C9A961]/10 text-[#C9A961]',
    neutral: 'border border-white/10 bg-[#16161C] text-[#9A9AA5]',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
