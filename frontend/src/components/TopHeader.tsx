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

export function TopHeader() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: ⌘K or Ctrl+K to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <header className="h-14 bg-[#0D0D11]/85 backdrop-blur-xl border-b border-white/[0.08] px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        
        {/* Global Real Estate Search Bar with Suggestions */}
        <div ref={containerRef} className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6E6E7A]" />
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
            className="w-full rounded-xl border border-white/[0.08] bg-[#141418] pl-9 pr-14 py-1.5 text-xs text-[#F5F5F7] placeholder:text-[#6E6E7A] focus:border-[#C9A961] focus:bg-[#181820] focus:outline-none focus:ring-2 focus:ring-[#C9A961]/20 transition-all"
          />

          {/* Right Action: Clear or Shortcut Key */}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10 text-[#9A9AA5] transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#1E1E26] border border-white/[0.08] text-[10px] text-[#9A9AA5] font-mono pointer-events-none">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-full min-w-[340px] sm:min-w-[480px] rounded-2xl bg-[#141418] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header / Loading state */}
              <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-[11px] text-[#9A9AA5] bg-[#181820]">
                <span className="font-semibold text-[#C9A961] uppercase tracking-wider text-[10px]">
                  {query ? `Suggestions for "${query}"` : 'Quick Property & Transaction Search'}
                </span>
                {loading && (
                  <span className="flex items-center gap-1.5 text-xs text-[#C9A961]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching...
                  </span>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04] custom-scrollbar">
                
                {/* 1. Property Inventory Results */}
                {properties.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#6E6E7A] flex items-center justify-between">
                      <span>Properties in Inventory</span>
                      <span className="text-[#9A9AA5]">{properties.length} matches</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {properties.map((prop) => (
                        <div
                          key={prop.id}
                          onClick={() => handleSelectProperty(prop)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] hover:border-[#C9A961]/30 border border-transparent transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/25 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#F5F5F7] group-hover:text-[#C9A961] transition-colors truncate">
                                  {prop.title}
                                </span>
                                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full border shrink-0 ${
                                  prop.status === 'AVAILABLE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                }`}>
                                  {prop.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#9A9AA5] flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-3 w-3 text-[#C9A961] shrink-0" />
                                <span className="truncate">{prop.address}, {prop.city}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0">
                            <div className="text-xs font-bold text-emerald-400 font-mono">
                              {formatIndianPrice(prop.price)}
                            </div>
                            <div className="text-[10px] text-[#6E6E7A] font-mono">
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
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#6E6E7A] flex items-center justify-between">
                      <span>Transactions & Contracts</span>
                      <span className="text-[#9A9AA5]">{deals.length} deals</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {deals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal.id)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] hover:border-blue-500/30 border border-transparent transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/25 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-[#F5F5F7] group-hover:text-blue-400 transition-colors truncate">
                                {deal.propertyAddress}
                              </div>
                              <div className="text-[11px] text-[#9A9AA5] flex items-center gap-1.5 mt-0.5 truncate">
                                <span>Buyer: <strong className="text-white">{deal.buyerName || 'Unassigned'}</strong></span>
                                <span className="text-[#6E6E7A]">·</span>
                                <span>Seller: <strong className="text-white">{deal.sellerName || 'Unassigned'}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">
                              {deal.status}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-[#6E6E7A] group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!loading && !hasResults && (
                  <div className="py-8 px-4 text-center">
                    <Building2 className="h-8 w-8 text-[#6E6E7A] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-[#F5F5F7]">
                      No properties or deals found matching "{query}"
                    </p>
                    <p className="text-[11px] text-[#6E6E7A] mt-1">
                      Try searching with street address, locality name (e.g. Whitefield), or buyer name.
                    </p>
                  </div>
                )}

              </div>

              {/* Suggestions Footer */}
              <div className="px-4 py-2 border-t border-white/[0.06] bg-[#101014] flex items-center justify-between text-[10px] text-[#6E6E7A]">
                <span>Click a property to view complete details</span>
                <span>Press <strong className="text-white">ESC</strong> to close</span>
              </div>

            </div>
          )}
        </div>

        {/* Right Utility Actions */}
        <div className="flex items-center gap-3">
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
