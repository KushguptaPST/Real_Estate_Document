import { Search, Command } from 'lucide-react';
import { UserMenu } from './UserMenu';

export function TopHeader() {
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
        {/* User Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
