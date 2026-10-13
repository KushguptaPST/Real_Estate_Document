import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  Plus,
  ShieldCheck,
  BookOpen,
  Layers,
  History,
  Users,
  BookOpenCheck,
  ChevronDown,
  FileText,
  Lock,
  LogOut,
  Sparkles,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AgentPlaybookModal } from './deal/AgentPlaybookModal';

const MAIN_NAV = [
  { href: '/deals', label: 'Transactions', icon: Layers },
  { href: '/leads', label: 'Lead Pipeline', icon: Users },
  { href: '/properties', label: 'Property Inventory', icon: Building2 },
  { href: '/knowledge', label: 'Knowledge Base', icon: BookOpenCheck },
];

const SECONDARY_NAV = [
  { href: '/organization', label: 'Organization & Team', icon: ShieldCheck },
  { href: '/audit', label: 'Audit Trail', icon: History },
  { href: '/contracts', label: 'Contracts Library', icon: FileText },
  { href: '/security', label: 'Security & Access', icon: Lock },
];

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, signOut } = useAuth();
  const [playbookOpen, setPlaybookOpen] = useState(false);

  return (
    <>
      <aside className="w-64 flex-shrink-0 bg-[#0D0D11] border-r border-white/[0.08] flex flex-col justify-between min-h-screen sticky top-0 z-30 select-none shadow-[1px_0_12px_rgba(0,0,0,0.5)]">
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <Link to="/deals" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#141418] text-[#C9A961] font-bold border border-[#C9A961]/25 group-hover:border-[#C9A961]/60 transition-colors">
                <Building2 className="h-4.5 w-4.5 text-[#C9A961]" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight text-[#F5F5F7] block">
                  Contingency Copilot
                </span>
                <span className="text-[10px] text-[#9A9AA5] font-normal block">
                  Real Estate Closing Suite
                </span>
              </div>
            </Link>
          </div>

          {/* Org Workspace Switcher */}
          <div className="px-3.5 py-2.5 border-b border-white/[0.08]">
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-xs font-medium text-[#F5F5F7] truncate">Apex Realty &amp; Escrow</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#9A9AA5] shrink-0" />
            </div>
          </div>

          {/* Main Navigation Group */}
          <div className="p-3.5 space-y-6">
            <div>
              <p className="px-2.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-[#6E6E7A]">
                Transaction Operations
              </p>
              <nav className="space-y-1">
                {MAIN_NAV.map((item) => {
                  const active =
                    item.href === '/deals'
                      ? pathname === '/deals'
                      : pathname === linkHref(item.href, pathname);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        active
                          ? 'bg-[#1A1A22] text-[#F5F5F7] border border-white/[0.08] shadow-xs'
                          : 'text-[#9A9AA5] hover:bg-white/[0.04] hover:text-[#F5F5F7]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${active ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] shadow-[0_0_6px_rgba(201,169,97,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Ingestion CTA Button */}
            <div className="px-1">
              <Link
                to="/upload"
                className="w-full btn-stripe-primary text-xs font-semibold py-2 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Ingest Contract PDF</span>
              </Link>
            </div>

            {/* Management & Governance Navigation */}
            <div>
              <p className="px-2.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-[#6E6E7A]">
                Governance &amp; Audit
              </p>
              <nav className="space-y-1">
                {SECONDARY_NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        active
                          ? 'bg-[#1A1A22] text-[#F5F5F7] border border-white/[0.08] shadow-xs'
                          : 'text-[#9A9AA5] hover:bg-white/[0.04] hover:text-[#F5F5F7]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-[#C9A961]' : 'text-[#6E6E7A]'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Trust Assurance Mini Card */}
            <div className="rounded-xl border border-[#C9A961]/20 bg-[#C9A961]/5 p-3 text-[11px] text-[#C9A961]">
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#C9A961]" />
                <span>E&amp;O Compliance Guard</span>
              </div>
              <p className="text-[10px] text-[#C9A961]/80 leading-snug">
                100% deterministic state date math across WA, CA, FL, TX &amp; NY contracts.
              </p>
            </div>
          </div>
        </div>

        {/* Footer User Profile & Agent Playbook */}
        <div className="p-3.5 border-t border-white/[0.08] space-y-2 bg-[#0A0A0B]">
          <button
            type="button"
            onClick={() => setPlaybookOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/40 text-xs font-medium text-[#9A9AA5] hover:text-[#F5F5F7] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-[#C9A961]" />
              <span>Brokerage Playbook</span>
            </span>
            <Sparkles className="h-3 w-3 text-[#C9A961]" />
          </button>

          {user && (
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[#181820] text-[#C9A961] font-bold flex items-center justify-center text-[10px] shrink-0 border border-[#C9A961]/30">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#F5F5F7] truncate">{user.name || 'Managing Broker'}</p>
                  <p className="text-[10px] text-[#6E6E7A] truncate font-mono">{user.email}</p>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-1.5 text-[#6E6E7A] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <AgentPlaybookModal isOpen={playbookOpen} onClose={() => setPlaybookOpen(false)} />
    </>
  );
}

function linkHref(href: string, pathname: string): string {
  return pathname === href || pathname.startsWith(`${href}/`) ? href : '';
}
