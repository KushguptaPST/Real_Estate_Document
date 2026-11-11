import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Command,
  Building2,
  FileText,
  MapPin,
  IndianRupee,
  Loader2,
  X,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { UserMenu } from './UserMenu';
import { propertiesApi, dealsApi } from '@/services/api';
import { formatIndianPrice } from '@/utils/currency';
import {
  PropertyDetailModal,
  type PropertyItem,
} from '@/components/property/PropertyDetailModal';
import { type Deal } from '@/types';

interface TopHeaderProps {
  onOpenCommandPalette?: () => void;
}

export function TopHeader({ onOpenCommandPalette }: TopHeaderProps = {}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: ⌘K or Ctrl+K to open Command Palette or focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette]);

  // Click outside listener to close suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for properties and deals
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [propsRes, dealsRes] = await Promise.allSettled([
          propertiesApi.list({ search: trimmed || undefined }),
          dealsApi.list(),
        ]);

        if (propsRes.status === 'fulfilled') {
          const fetchedProps = (propsRes.value || []).slice(0, 5);
          setProperties(fetchedProps);
        }

        if (dealsRes.status === 'fulfilled') {
          const allDeals = dealsRes.value || [];
          if (trimmed) {
            const lower = trimmed.toLowerCase();
            const matched = allDeals.filter(
              (d) =>
                d.propertyAddress.toLowerCase().includes(lower) ||
                d.buyerName?.toLowerCase().includes(lower) ||
                d.sellerName?.toLowerCase().includes(lower) ||
                d.id.toLowerCase().includes(lower)
            );
            setDeals(matched.slice(0, 4));
          } else {
            setDeals(allDeals.slice(0, 3));
          }
        }
      } catch (err) {
        console.error('Failed to search properties/deals:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  function handleSelectProperty(prop: PropertyItem) {
    setIsOpen(false);
    setSelectedProperty(prop);
  }

  function handleSelectDeal(dealId: string) {
    setIsOpen(false);
    navigate(`/deals/${dealId}`);
  }

  const hasResults = properties.length > 0 || deals.length > 0;

  return (
    <>
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-2xs">
        
        {/* Global Real Estate Search Bar with Suggestions */}
        <div ref={containerRef} className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            placeholder="Search property address, title, MLS #, or deal..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-14 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
          />

          {/* Right Action: Clear or Shortcut Key */}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-500 font-mono pointer-events-none shadow-2xs">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-full min-w-[340px] sm:min-w-[480px] rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header / Loading state */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  {query ? `Suggestions for "${query}"` : 'Quick Property & Transaction Search'}
                </span>
                {loading && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching...
                  </span>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                
                {/* 1. Property Inventory Results */}
                {properties.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Properties in Inventory</span>
                      <span className="text-slate-600 font-semibold">{properties.length} matches</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {properties.map((prop) => (
                        <div
                          key={prop.id}
                          onClick={() => handleSelectProperty(prop)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-200 border border-transparent transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                  {prop.title}
                                </span>
                                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full border shrink-0 ${
                                  prop.status === 'AVAILABLE'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {prop.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{prop.address}, {prop.city}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0">
                            <div className="text-xs font-bold text-emerald-700 font-mono">
                              {formatIndianPrice(prop.price)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {prop.bedrooms}B · {prop.bathrooms}Ba
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Transaction / Deal Results */}
                {deals.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Transactions & Contracts</span>
                      <span className="text-slate-600 font-semibold">{deals.length} deals</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {deals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal.id)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-200 border border-transparent transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                                {deal.propertyAddress}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                                <span>Buyer: <strong className="text-slate-700">{deal.buyerName || 'Unassigned'}</strong></span>
                                <span className="text-slate-300">·</span>
                                <span>Seller: <strong className="text-slate-700">{deal.sellerName || 'Unassigned'}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {deal.status}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!loading && !hasResults && (
                  <div className="py-8 px-4 text-center">
                    <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-800">
                      No properties or deals found matching "{query}"
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Try searching with street address, locality name (e.g. Whitefield), or buyer name.
                    </p>
                  </div>
                )}

              </div>

              {/* Suggestions Footer */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-500">
                <span>Click a property to view complete details</span>
                <span>Press <strong className="text-slate-700">ESC</strong> to close</span>
              </div>

            </div>
          )}
        </div>

        {/* Right Utility Actions */}
        <div className="flex items-center gap-2.5">
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Open Navigation Command Palette (⌘K)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#141418] text-[11px] font-medium text-[#9A9AA5] hover:text-white hover:border-[#C9A961]/40 hover:bg-[#181820] transition-colors cursor-pointer"
            >
              <Command className="h-3 w-3 text-[#C9A961]" />
              <span className="hidden sm:inline">Commands</span>
              <kbd className="hidden sm:inline text-[9px] bg-white/[0.08] px-1 py-0.2 rounded font-mono text-[#F5F5F7]">⌘K</kbd>
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      {/* Property Quick View Detail Modal */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          isOpen={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </>
  );
}
