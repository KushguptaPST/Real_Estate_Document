import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { LogOut, ChevronDown, User as UserIcon, Shield } from 'lucide-react';
import { Badge } from './ui/badge';

function Avatar({ user, size }: { user: User; size: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-xs';
  if (user.pictureUrl) {
    return <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" className={`${dims} rounded-full object-cover border border-white/[0.1]`} />;
  }
  return (
    <span className={`${dims} flex items-center justify-center rounded-full bg-[#181820] font-semibold text-[#C9A961] border border-[#C9A961]/30`}>
      {(user.name ?? user.email).charAt(0).toUpperCase()}
    </span>
  );
}

export function UserMenu() {
  const { user, signOut } = useAuth();
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
        className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-[#F5F5F7] transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A961]/50 cursor-pointer"
      >
        <Avatar user={user} size="sm" />
        <span className="hidden max-w-[130px] truncate text-xs font-medium md:inline text-[#F5F5F7]">{user.name ?? user.email}</span>
        <ChevronDown
          className={`h-3 w-3 text-[#9A9AA5] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
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
            className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141418] shadow-2xl z-50 text-[#F5F5F7]"
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] p-3.5 bg-[#181820]">
              <Avatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-semibold text-[#F5F5F7]">{user.name || 'Agent User'}</p>
                </div>
                <p className="truncate text-[11px] text-[#9A9AA5] font-mono">{user.email}</p>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-[#9A9AA5]">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#C9A961]" />
                  <span>Role</span>
                </span>
                <Badge variant="gold" className="text-[10px]">Brokerage Admin</Badge>
              </div>

              <div className="h-px bg-white/[0.08] my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10 cursor-pointer"
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
