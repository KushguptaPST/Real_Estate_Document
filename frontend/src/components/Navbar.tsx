import { Link, useLocation } from 'react-router-dom';
import { Building2, Plus, ShieldCheck, Layers, History, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { EigenEstateIcon } from '@/components/brand/EigenEstateLogo';

const NAV_LINKS = [
  { href: '/leads', label: 'Lead Pipeline', icon: Users },
  { href: '/properties', label: 'Inventory', icon: Building2 },
  { href: '/deals', label: 'Transactions', icon: Layers },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/organization', label: 'Brokerage Team', icon: ShieldCheck },
  { href: '/upload', label: 'Ingest Contract', icon: Plus, highlight: true },
  { href: '/audit', label: 'Audit Trail', icon: History },
];

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <header className="sticky top-0 z-40 stripe-nav bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand Logo */}
        <Link to="/deals" className="flex items-center gap-3 group py-0.5">
          <img
            src="/brand/eigen-estate-full.png"
            alt="EigenEstate"
            style={{ height: '28px', width: 'auto' }}
            className="h-7 w-auto object-contain hover:opacity-90 transition-opacity"
          />
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

          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
