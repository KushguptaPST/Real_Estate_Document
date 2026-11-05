import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' | 'neutral' | 'gold' | 'soft-blue';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-normal transition-colors select-none';

  const variants = {
    default: 'border border-slate-200 bg-slate-100 text-slate-800',
    gold: 'border border-amber-200/80 bg-amber-50 text-amber-800 font-medium',
    secondary: 'border border-slate-200/60 bg-slate-50 text-slate-600',
    outline: 'border border-slate-200 text-slate-700 bg-transparent',
    destructive: 'border border-rose-200 bg-rose-50 text-rose-700',
    success: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border border-amber-200 bg-amber-50 text-amber-800',
    info: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
    neutral: 'border border-slate-200 bg-slate-50 text-slate-600',
    'soft-blue': 'border border-slate-200 bg-slate-100 text-slate-800',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
