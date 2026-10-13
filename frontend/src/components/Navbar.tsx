import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Plus, ShieldCheck, BookOpen, Layers, History, Users, BookOpenCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { AgentPlaybookModal } from './deal/AgentPlaybookModal';

const NAV_LINKS = [
  { href: '/leads', label: 'Lead Pipeline', icon: Users },
  { href: '/properties', label: 'Inventory', icon: Building2 },
  { href: '/knowledge', label: 'Knowledge Base', icon: BookOpenCheck },
  { href: '/organization', label: 'Brokerage Team', icon: ShieldCheck },
  { href: '/deals', label: 'Transactions', icon: Layers },
  { href: '/upload', label: 'Ingest Contract', icon: Plus, highlight: true },
  { href: '/audit', label: 'Audit Trail', icon: History },
];

export function Navbar() {
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <>
      <header className="sticky top-0 z-40 stripe-nav bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Brand Logo */}
          <Link to="/deals" className="flex items-center gap-2.5 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a] text-white shadow-xs group-hover:bg-[#1e293b] ring-1 ring-slate-900/10 transition-all">
              <Building2 className="h-4.5 w-4.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-[#0f172a] group-hover:text-[#1d4ed8] transition-colors">
                  Contingency Copilot
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
                  <CheckCircle2 className="h-3 w-3 text-[#059669]" />
                  MLS &amp; Escrow Suite
                </span>
              </div>
              <span className="text-[10px] text-[#64748b] font-medium">Brokerage Escrow &amp; Contract Surveillance</span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="flex items-center gap-1 text-xs font-semibold bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0]">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === '/deals'
                  ? pathname === '/deals'
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;

              if (link.highlight) {
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white px-3 py-1.5 text-xs font-semibold shadow-2xs active:scale-[0.98] transition-all"
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                    <span>{link.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all ${
                    active
                      ? 'bg-white text-[#0f172a] font-bold shadow-2xs border border-[#e2e8f0]'
                      : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#1d4ed8]' : 'text-[#94a3b8]'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="h-4 w-px bg-[#e2e8f0] mx-1 hidden lg:block" />

            <button
              type="button"
              onClick={() => setPlaybookOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#475569] border border-[#e2e8f0] transition-all cursor-pointer shadow-2xs"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#1d4ed8]" />
              <span>Playbook</span>
            </button>

            <UserMenu />
          </nav>
        </div>
      </header>

      {/* Global Agent Playbook Modal */}
      <AgentPlaybookModal
        isOpen={playbookOpen}
        onClose={() => setPlaybookOpen(false)}
      />
    </>
  );
}
