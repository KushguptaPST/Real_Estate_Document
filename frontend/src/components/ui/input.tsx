import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-white/10 bg-[#101014] px-3.5 py-2 text-xs text-[#F5F5F7] shadow-sm transition-all file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[#5E5E6C] focus-visible:outline-none focus-visible:border-[#C9A961]/70 focus-visible:ring-2 focus-visible:ring-[#C9A961]/20 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';
