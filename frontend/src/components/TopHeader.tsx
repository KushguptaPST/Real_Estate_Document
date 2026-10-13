import { useState } from 'react';
import { Search, Bell, ShieldCheck, Command, CheckCircle2 } from 'lucide-react';
import { UserMenu } from './UserMenu';

export function TopHeader() {
  const [unreadCount] = useState(3);

  return (
    <header className="h-14 bg-[#0D0D11]/85 backdrop-blur-xl border-b border-white/[0.08] px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      {/* Global Real Estate Search Bar with Keyboard Shortcut */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6E6E7A]" />
        <input
          type="text"
          placeholder="Search MLS #, property address, buyer, or contingency..."
          className="w-full rounded-xl border border-white/[0.08] bg-[#141418] pl-9 pr-12 py-1.5 text-xs text-[#F5F5F7] placeholder:text-[#6E6E7A] focus:border-[#C9A961] focus:bg-[#181820] focus:outline-none focus:ring-2 focus:ring-[#C9A961]/20 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#1E1E26] border border-white/[0.08] text-[10px] text-[#9A9AA5] font-mono">
          <Command className="h-2.5 w-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* Right Utility Actions */}
      <div className="flex items-center gap-3">
        {/* Clean System Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#9A9AA5] font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span>MLS Live</span>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 text-[#9A9AA5] hover:text-[#F5F5F7] hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer"
          title="Notifications & Alerts"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A961] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A961]"></span>
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-white/[0.08]" />

        {/* User Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
