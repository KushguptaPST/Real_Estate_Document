import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { LogOut, ChevronDown, User as UserIcon, Shield, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';

function Avatar({ user, size }: { user: User; size: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-xs';
  if (user.pictureUrl) {
    return <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" className={`${dims} rounded-full object-cover border border-slate-200`} />;
  }
  return (
    <span className={`${dims} flex items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 border border-slate-200`}>
      {(user.name ?? user.email).charAt(0).toUpperCase()}
    </span>
  );
}

export function UserMenu() {
  const { user, signOut, signInAsDemoAgent } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative ml-2 pl-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-slate-800 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 cursor-pointer border border-transparent hover:border-slate-200"
      >
        <Avatar user={user} size="sm" />
        <span className="hidden max-w-[130px] truncate text-xs font-medium md:inline text-slate-800">{user.name ?? user.email}</span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="menu"
            className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-50 text-slate-900"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 p-3.5 bg-slate-50/80">
              <Avatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-semibold text-slate-900">{user.name || 'Agent User'}</p>
                </div>
                <p className="truncate text-[11px] text-slate-500 font-mono">{user.email}</p>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Role</span>
                </span>
                <Badge variant={user.role === 'OWNER' ? 'soft-blue' : 'outline'} className="text-[10px]">
                  {user.role === 'OWNER' ? 'Brokerage Admin' : 'Real Estate Advisor'}
                </Badge>
              </div>

              {user.organizationId === 'demo-sandbox-org' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    const nextRole = user.role === 'OWNER' ? 'AGENT' : 'OWNER';
                    await signInAsDemoAgent(nextRole);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-700 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Switch to {user.role === 'OWNER' ? 'Advisor Agent' : 'Broker Owner'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Sandbox</span>
                </button>
              )}

              <div className="h-px bg-slate-100 my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
