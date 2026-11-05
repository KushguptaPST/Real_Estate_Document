import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'brand' | 'gold' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
  asChild?: boolean;
}

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className = '',
}: {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
} = {}) {
  const baseStyles =
    'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.99]';

  const variants = {
    default:
      'bg-[#0A0A0A] text-white hover:bg-slate-800 active:bg-slate-950 shadow-xs',
    gold:
      'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-xs',
    brand:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs',
    secondary:
      'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs',
    outline:
      'border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    destructive:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
    link:
      'text-emerald-700 underline-offset-4 hover:underline p-0 h-auto rounded-none',
  };

  const sizes = {
    default: 'h-9 px-4 py-2 text-xs',
    sm: 'h-8 px-3.5 py-1 text-xs',
    xs: 'h-7 px-2.5 py-0.5 text-[11px]',
    lg: 'h-10 px-5 py-2.5 text-sm',
    icon: 'h-9 w-9 p-0',
  };

  return cn(baseStyles, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, disabled, children, ...props }, ref) => {
    const combinedClassName = buttonVariants({ variant, size, className });

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string; ref?: React.Ref<unknown> }>, {
        className: cn(combinedClassName, (children.props as { className?: string })?.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={combinedClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
