import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Layers,
  Users,
  Building2,
  TrendingUp,
  Plus,
  ShieldCheck,
  History,
  Lock,
  ArrowRight,
  X,
  PhoneCall,
  Cpu,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navigation' | 'Actions';
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: 'deals',
    title: 'Transactions Pipeline',
    subtitle: 'View escrow transactions and active contingency dates',
    category: 'Navigation',
    icon: Layers,
    path: '/deals',
  },
  {
    id: 'leads',
    title: 'Lead Pipeline',
    subtitle: 'Manage inbound buyer leads, chats, and showing requests',
    category: 'Navigation',
    icon: Users,
    path: '/leads',
  },
  {
    id: 'campaigns',
    title: 'High-Scale Campaign Dialer',
    subtitle: 'Manage batch outbound calls (10,000+ leads) with AMD & trunk governor',
    category: 'Navigation',
    icon: PhoneCall,
    path: '/campaigns',
  },
  {
    id: 'admin',
    title: 'Super-Admin Mission Control',
    subtitle: 'Global multi-tenant telemetry, P&L margins, and 1-click model failover',
    category: 'Navigation',
    icon: Cpu,
    path: '/admin',
  },
  {
    id: 'properties',
    title: 'Property Inventory',
    subtitle: 'Browse active listings, prices, and buyer match scores',
    category: 'Navigation',
    icon: Building2,
    path: '/properties',
  },
  {
    id: 'upload',
    title: 'Ingest Contract PDF',
    subtitle: 'Upload a purchase agreement for automatic AI clause extraction',
    category: 'Actions',
    icon: Plus,
    path: '/upload',
  },
  {
    id: 'analytics',
    title: 'Analytics & ROI',
    subtitle: 'Review conversion metrics and deal volume',
    category: 'Navigation',
    icon: TrendingUp,
    path: '/analytics',
  },
  {
    id: 'organization',
    title: 'Organization & Team',
    subtitle: 'Invite agents, manage roles, and inspect API credentials',
    category: 'Navigation',
    icon: ShieldCheck,
    path: '/organization',
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    subtitle: 'Inspect immutable, court-ready mutation logs',
    category: 'Navigation',
    icon: History,
    path: '/audit',
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    subtitle: 'View tenant boundaries, encryption, and E&O safeguards',
    category: 'Navigation',
    icon: Lock,
    path: '/security',
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredItems = COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleSelect(item: CommandItem) {
    onClose();
    navigate(item.path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-slate-900/40 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[500px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Box */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search transactions, leads, navigation..."
              className="flex-1 bg-transparent border-0 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shadow-2xs">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching pages or actions found for "{query}"
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 text-emerald-950 border border-emerald-200'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? 'bg-[#0A0A0A] text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate leading-tight">{item.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                    {isSelected && <ArrowRight className="h-3.5 w-3.5 text-emerald-700 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Command Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              Navigate with <kbd className="font-mono bg-white border border-slate-200 rounded px-1 text-[10px]">↑</kbd> <kbd className="font-mono bg-white border border-slate-200 rounded px-1 text-[10px]">↓</kbd>
            </span>
            <span className="flex items-center gap-1">
              Select with <kbd className="font-mono bg-white border border-slate-200 rounded px-1.5 text-[10px]">ENTER</kbd>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
