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
    'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A961]/40 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

  const variants = {
    default:
      'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#DFBF77] active:bg-[#B5934C] shadow-sm hover:shadow-[0_0_20px_rgba(201,169,97,0.35)]',
    gold:
      'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#DFBF77] active:bg-[#B5934C] shadow-sm hover:shadow-[0_0_20px_rgba(201,169,97,0.35)]',
    brand:
      'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#DFBF77] active:bg-[#B5934C] shadow-sm',
    secondary:
      'bg-[#1A1A22] text-[#F5F5F7] border border-white/10 hover:bg-[#22222C] hover:border-[#C9A961]/40 active:scale-[0.99]',
    outline:
      'border border-white/10 bg-transparent text-[#F5F5F7] hover:bg-white/5 hover:border-white/20 active:scale-[0.99]',
    ghost:
      'text-[#9A9AA5] hover:bg-white/5 hover:text-[#F5F5F7] active:scale-[0.99]',
    destructive:
      'bg-rose-600/90 text-white hover:bg-rose-500 shadow-sm active:scale-[0.99]',
    link:
      'text-[#C9A961] underline-offset-4 hover:underline p-0 h-auto rounded-none',
  };

  const sizes = {
    default: 'h-9 px-4 py-2 text-xs',
    sm: 'h-8 px-3.5 py-1 text-xs',
    xs: 'h-7 px-2.5 py-0.5 text-[11px]',
    lg: 'h-11 px-6 py-2.5 text-sm',
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
