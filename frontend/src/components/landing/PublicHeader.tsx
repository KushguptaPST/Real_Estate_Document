import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EigenEstateIcon } from '@/components/brand/EigenEstateLogo';

export function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <Link to="/" className="flex items-center group py-1">
          <img
            src="/brand/eigen-estate-full.png"
            alt="EigenEstate"
            style={{ height: '32px', width: 'auto' }}
            className="h-8 w-auto object-contain hover:opacity-90 transition-opacity"
          />
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
              <Link
                to="/login"
                className="inline-flex text-[13px] font-semibold text-zinc-700 hover:text-zinc-950 px-3.5 py-1.5 rounded-full hover:bg-zinc-100 transition-all"
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
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 text-xs font-semibold rounded-full border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
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

