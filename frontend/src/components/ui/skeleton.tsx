import type { HTMLAttributes } from 'react';

/**
 * Base shimmer skeleton block.
 */
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-lg bg-slate-100 ${className}`}
      {...props}
    />
  );
}

/**
 * Shimmer row list matching Deals, Leads, Organization team, and Ledger tables.
 */
export function TableRowsSkeleton({ rows = 5, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden divide-y divide-slate-100">
      <div className="bg-slate-50/80 px-5 py-3.5 flex items-center justify-between gap-4">
        <Skeleton className="h-3.5 w-32" />
        <div className="hidden sm:flex items-center gap-6">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className={`px-5 ${compact ? 'py-3.5' : 'py-4'} flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 max-w-xs">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 shrink-0">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Shimmer grid matching Property inventory cards or Plan cards.
 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-7 w-1/3" />
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 flex-1 rounded-xl" />
            <Skeleton className="h-8 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Page-level shimmer skeleton tailored for route transitions and workspace shells.
 */
export function WorkspacePageSkeleton({ variant = 'default' }: { variant?: 'default' | 'billing' | 'onboarding' }) {
  if (variant === 'onboarding') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex items-center justify-between gap-4">
          <div className="space-y-2.5 flex-1">
            <Skeleton className="h-5 w-48 rounded-full" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-36 rounded-xl shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl shrink-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      {variant === 'billing' ? (
        <>
          <Skeleton className="h-11 w-80 max-w-full rounded-xl" />
          <CardGridSkeleton count={3} />
        </>
      ) : (
        <TableRowsSkeleton rows={5} />
      )}
    </div>
  );
}
