import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Menu, X, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function PublicHeader() {
  const { user, signInAsDemoAgent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      await signInAsDemoAgent('AGENT');
      navigate('/deals');
    } catch (err) {
      console.error('Demo login error:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Workflow', href: '/#workflow' },
    { label: 'Capabilities', href: '/#features' },
    { label: 'ROI Calculator', href: '/#calculator' },
    { label: '50-State Rules', href: '/contracts-library', isRoute: true },
    { label: 'Pricing', href: '/pricing', isRoute: true },
    { label: 'Security & E&O', href: '/security', isRoute: true },
    { label: 'Documentation', href: '/docs', isRoute: true },
  ];

  const isCurrentActive = (href: string) => {
    if (href.startsWith('/#')) {
      return location.pathname === '/' && location.hash === href.replace('/', '');
    }
    return location.pathname === href;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl border-b border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
          : 'bg-white/80 backdrop-blur-md border-b border-zinc-200/70'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0A0A] text-white shadow-2xs group-hover:scale-105 transition-transform shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#0A0A0A]">
            Contingency Copilot
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-[13px] text-zinc-600 font-medium">
          {navLinks.map((link) => {
            const active = isCurrentActive(link.href);
            if (link.isRoute) {
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`transition-colors ${
                    active ? 'text-zinc-950 font-semibold' : 'hover:text-zinc-950'
                  }`}
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <a
                key={link.label}
                href={link.href}
                className={`transition-colors ${
                  active ? 'text-zinc-950 font-semibold' : 'hover:text-zinc-950'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Right Action CTAs */}
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/deals"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-all hover:-translate-y-0.5 shadow-2xs"
            >
              <span>Brokerage Pipeline</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              {/* 1-Click Instant Demo Login */}
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 transition-all shadow-2xs hover:border-emerald-400 cursor-pointer disabled:opacity-50"
                title="Instant 1-Click Demo Sandbox (no password required)"
              >
                {demoLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                )}
                <span>Demo Login</span>
              </button>

              <Link
                to="/login"
                className="hidden sm:inline-flex text-[13px] font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-b border-[#E5E7EB] bg-white/95 backdrop-blur-2xl px-6 py-6 space-y-4 shadow-xl"
          >
            <nav className="flex flex-col space-y-1 text-sm font-medium text-zinc-700">
              {navLinks.map((link) => {
                if (link.isRoute) {
                  return (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 px-3 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      {link.label}
                    </Link>
                  );
                }
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 px-3 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-zinc-100 flex flex-col gap-2">
              {user ? (
                <Link
                  to="/deals"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-xs font-semibold rounded-full bg-[#0A0A0A] text-white shadow-2xs"
                >
                  Open Brokerage Workspace
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await handleDemoLogin();
                    }}
                    disabled={demoLoading}
                    className="w-full py-2.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {demoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-emerald-700" />
                    )}
                    <span>1-Click Demo Login</span>
                  </button>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 text-xs font-medium rounded-full border border-zinc-200 text-zinc-800"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 text-xs font-semibold rounded-full bg-[#0A0A0A] text-white shadow-2xs"
                  >
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

