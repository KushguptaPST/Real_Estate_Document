import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  ShieldCheck,
  Layers,
  History,
  Users,
  LogOut,
  TrendingUp,
  PhoneCall,
  Cpu,
  ChevronsUpDown,
  Check,
  Settings,
  UserPlus,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSidebar } from '@/context/SidebarContext';

const MAIN_NAV = [
  { href: '/deals', label: 'Deals & Escrows', shortLabel: 'Deals', icon: Layers },
  { href: '/leads', label: 'Lead Pipeline', shortLabel: 'Leads', icon: Users },
  { href: '/campaigns', label: 'AI Voice Dialer', shortLabel: 'Dialer', icon: PhoneCall },
  { href: '/properties', label: 'Properties', shortLabel: 'Properties', icon: Building2 },
  { href: '/analytics', label: 'Analytics', shortLabel: 'Analytics', icon: TrendingUp },
];

const SECONDARY_NAV = [
  { href: '/organization', label: 'Team & Settings', shortLabel: 'Team', icon: ShieldCheck },
  { href: '/admin', label: 'Admin Console', shortLabel: 'Admin', icon: Cpu },
  { href: '/audit', label: 'Audit Trail', shortLabel: 'Audit', icon: History },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const { user, signOut, signInAsDemoAgent } = useAuth();
  const { toast } = useToast();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close workspace dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setWorkspaceMenuOpen(false);
    }
    if (workspaceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [workspaceMenuOpen]);

  // Global ⌘I / Ctrl+I quick action shortcut to navigate to /upload
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        navigate('/upload');
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate]);

  const handleCopyOrgId = () => {
    const orgId = user?.organizationId || 'demo-sandbox-org';
    navigator.clipboard.writeText(orgId);
    toast.success('Workspace ID Copied', orgId);
    setWorkspaceMenuOpen(false);
  };

  const handleToggleSandboxRole = async () => {
    if (!user || switchingRole) return;
    try {
      setSwitchingRole(true);
      const nextRole = user.role === 'OWNER' ? 'AGENT' : 'OWNER';
      await signInAsDemoAgent(nextRole);
      toast.success(
        nextRole === 'OWNER'
          ? 'Switched to Broker Admin (Owner privileges)'
          : 'Switched to Real Estate Advisor'
      );
      setWorkspaceMenuOpen(false);
    } catch {
      toast.error('Failed to switch sandbox role');
    } finally {
      setSwitchingRole(false);
    }
  };

  const orgName = user?.organizationName || 'Demo Sandbox Brokerage';

  return (
    <aside
      className={`flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-full z-30 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* ── Top Header & Action Trigger (Pinned to top) ── */}
      <div className="shrink-0">
        {/* ── Linear / Stripe Standard: Exact h-14 (56px) Grid-Aligned Workspace Header ── */}
        <div
          ref={menuRef}
          className={`relative h-14 border-b border-slate-200/80 flex items-center bg-white ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
          }`}
        >
          {isCollapsed ? (
            /* Collapsed Monogram Button with Floating Tooltip */
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A] text-white font-bold shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={orgName}
              >
                <Building2 className="h-5 w-5 text-emerald-400" />
              </button>

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {orgName} (Click to manage)
              </div>
            </div>
          ) : (
            /* Expanded Workspace Switcher */
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer group text-left min-w-0"
              title="Switch workspace or manage organization"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Branded Monogram Badge */}
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-[#0A0A0A] text-white font-bold shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                  <Building2 className="h-4.5 w-4.5 text-emerald-400" />
                </div>

                {/* Title & Plan Metadata */}
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm font-bold tracking-tight text-slate-900 truncate block max-w-[175px]"
                    title={orgName}
                  >
                    {orgName}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500 font-medium tracking-tight">
                      Enterprise • WA MLS
                    </span>
                  </div>
                </div>
              </div>

              <ChevronsUpDown className="h-4 w-4 text-slate-400 group-hover:text-slate-700 shrink-0 transition-colors ml-1" />
            </button>
          )}

          {/* ── Interactive Workspace Command Popover ── */}
          {workspaceMenuOpen && (
            <div
              className={`absolute bg-white rounded-2xl border border-slate-200/90 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1 ${
                isCollapsed
                  ? 'left-20 top-2 w-64'
                  : 'top-14 left-2 right-2'
              }`}
            >
              {/* Active Workspace Card */}
              <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{orgName}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  ID: {user?.organizationId || 'demo-sandbox-org'}
                </p>
              </div>

              {/* Workspace List */}
              <div className="pt-1">
                <p className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Active Workspaces
                </p>
                <button
                  type="button"
                  onClick={() => setWorkspaceMenuOpen(false)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-900 bg-slate-100/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="truncate">{orgName}</span>
                  </div>
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                </button>
              </div>

              {/* Sandbox Role Switcher Option */}
              {user?.organizationId === 'demo-sandbox-org' && (
                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleToggleSandboxRole}
                    disabled={switchingRole}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${switchingRole ? 'animate-spin' : ''}`} />
                      <span>
                        Switch View: <strong className="font-semibold">{user.role === 'OWNER' ? 'Broker Admin' : 'Agent'}</strong>
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Management Shortcuts */}
              <div className="pt-1 border-t border-slate-100 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    navigate('/organization');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Workspace Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    navigate('/organization?tab=team');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 text-slate-400" />
                  <span>Invite Agents &amp; TCs</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyOrgId}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-slate-400" />
                  <span>Copy Workspace CUID</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Linear-Style Quick Action Bar ── */}
        <div className={`p-3 pb-1.5 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {isCollapsed ? (
            <div className="relative group">
              <Link
                to="/upload"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Upload Agreement (⌘I)"
              >
                <Plus className="h-5 w-5 text-emerald-400" />
              </Link>
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Upload Agreement (⌘I)
              </div>
            </div>
          ) : (
            <Link
              to="/upload"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white text-sm font-semibold shadow-xs transition-all hover:-translate-y-0.5 group cursor-pointer"
              title="Ingest executed purchase agreement PDF"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Upload Agreement</span>
              </div>
              <kbd className="text-xs font-mono bg-white/15 px-2 py-0.5 rounded text-white/90 font-normal">
                ⌘I
              </kbd>
            </Link>
          )}
        </div>
      </div>

      {/* ── Middle Scrollable Nav Group (Scrolls internally if needed, NEVER stretches the page) ── */}
      <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        <div>
          {!isCollapsed && (
            <p className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
          )}
          <nav className="space-y-1">
            {MAIN_NAV.map((item) => {
              const active =
                item.href === '/deals'
                  ? pathname === '/deals'
                  : pathname === linkHref(item.href, pathname);
              const Icon = item.icon;

              if (isCollapsed) {
                return (
                  <div key={item.href} className="relative group flex justify-center">
                    <Link
                      to={item.href}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all w-[68px] mx-auto border ${
                        active
                          ? 'bg-slate-100 text-slate-900 border-slate-200/90 shadow-2xs font-bold'
                          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${active ? 'text-slate-900' : 'text-slate-500'}`} />
                      <span className="text-[11px] font-semibold leading-tight tracking-tight truncate max-w-full text-center">
                        {item.shortLabel}
                      </span>
                      {active && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      )}
                    </Link>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {item.label}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    active
                      ? 'bg-slate-100 text-slate-900 border-slate-200/80 shadow-2xs font-semibold'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Divider in collapsed mode */}
        {isCollapsed && <div className="h-px bg-slate-200/80 w-10 mx-auto my-1" />}

        {/* ── Management & Settings Navigation ── */}
        <div>
          {!isCollapsed && (
            <p className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Management
            </p>
          )}
          <nav className="space-y-1">
            {SECONDARY_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              if (isCollapsed) {
                return (
                  <div key={item.href} className="relative group flex justify-center">
                    <Link
                      to={item.href}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all w-[68px] mx-auto border ${
                        active
                          ? 'bg-slate-100 text-slate-900 border-slate-200/90 shadow-2xs font-bold'
                          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${active ? 'text-slate-900' : 'text-slate-500'}`} />
                      <span className="text-[11px] font-semibold leading-tight tracking-tight truncate max-w-full text-center">
                        {item.shortLabel}
                      </span>
                      {active && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      )}
                    </Link>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {item.label}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    active
                      ? 'bg-slate-100 text-slate-900 border-slate-200/80 shadow-2xs font-semibold'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Fixed Bottom Footer (Permanently Pinned to Viewport Bottom) ── */}
      <div
        className={`shrink-0 mt-auto p-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center ${
          isCollapsed ? 'flex-col gap-2.5 justify-center py-3' : 'justify-between'
        }`}
      >
        {isCollapsed ? (
          <>
            <div className="relative group">
              <div className="flex h-9 w-9 items-center justify-center text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                50-State Statutory SLA
              </div>
            </div>

            <div className="relative group">
              <button
                onClick={signOut}
                className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Sign Out
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-800">50-State Statutory SLA</span>
            </div>

            <button
              onClick={signOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function linkHref(href: string, pathname: string): string {
  return pathname === href || pathname.startsWith(`${href}/`) ? href : '';
}
