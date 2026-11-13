import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { propertiesApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PropertyMarketingModal } from '@/components/property/PropertyMarketingModal';
import { PropertyCmaModal } from '@/components/property/PropertyCmaModal';
import { CsvImportModal } from '@/components/CsvImportModal';
import { formatPropertyPrice, formatPropertyPriceFull } from '@/utils/currency';
import { useToast } from '@/context/ToastContext';
import {
  Building2,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Tag,
  BedDouble,
  Bath,
  MapPin,
  Megaphone,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

export function PropertiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === 'OWNER';
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'UNDER_CONTRACT' | 'SOLD'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selectedMarketingProperty, setSelectedMarketingProperty] = useState<any | null>(null);
  const [selectedCmaProperty, setSelectedCmaProperty] = useState<any | null>(null);

  // New Property Form State
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [bedrooms, setBedrooms] = useState<number | ''>('');
  const [bathrooms, setBathrooms] = useState<number | ''>('');
  const [propertyType, setPropertyType] = useState('CONDO');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Debounce search keystrokes by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProperties();
  }, [debouncedSearch, statusFilter]);

  async function fetchProperties() {
    try {
      setLoading(true);
      setError(null);
      const data = await propertiesApi.list({
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setProperties(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Listing title is required';
    if (!address.trim()) errs.address = 'Street address is required';
    if (!city.trim()) errs.city = 'City / locality is required';
    if (!price || Number(price) <= 0) errs.price = 'Valid asking price is required';
    if (!bedrooms || Number(bedrooms) <= 0) errs.bedrooms = 'Bedrooms count is required';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      toast.error('Missing Required Fields', 'Please complete the highlighted fields before saving.');
      return;
    }

    try {
      setSubmitting(true);
      await propertiesApi.create({
        title: title.trim(),
        address: address.trim(),
        city: city.trim(),
        price: Number(price),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms || 2),
        propertyType,
        status: 'AVAILABLE',
      });
      setShowAddModal(false);
      setTitle('');
      setAddress('');
      setCity('');
      setPrice('');
      setBedrooms('');
      setBathrooms('');
      setFormErrors({});
      fetchProperties();
      toast.success('Property listing created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create property');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCount = properties.length;
  const availableCount = properties.filter((p) => !p.status || p.status === 'AVAILABLE').length;
  const underContractCount = properties.filter((p) => p.status === 'UNDER_CONTRACT' || p.status === 'PENDING').length;
  const avgPrice =
    totalCount > 0
      ? Math.round(properties.reduce((acc, p) => acc + (p.price || 0), 0) / totalCount)
      : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800 border border-slate-200 shrink-0 shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                MLS Property Inventory &amp; Valuation
              </h1>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-700 border border-zinc-200">
                MLS Grounded
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verified property portfolio evaluated deterministically by the AI Lead Matcher and CMA Engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-stripe-secondary text-xs h-9 px-3.5 gap-1.5 cursor-pointer bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            <span>Import MLS / CSV</span>
          </button>
          {isOwner ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-stripe-primary text-xs h-9 px-4 gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Listing</span>
            </button>
          ) : (
            <div title="Only organization owners can add listings">
              <button disabled className="btn-stripe-secondary text-xs h-9 px-4 opacity-50 cursor-not-allowed">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Listing (Owner Only)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Metric Stat Cards Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Listings */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`rounded-2xl p-5 bg-white border hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] group shadow-xs cursor-pointer ${
            statusFilter === 'ALL' ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Listings</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 border border-slate-200 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{totalCount}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Active MLS Inventory</span>
            </div>
          </div>
        </div>

        {/* Average Listing Price */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] group shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Average Listing Price</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Tag className="h-5 w-5 text-emerald-700" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight" title={avgPrice > 0 ? formatPropertyPriceFull(avgPrice) : undefined}>
              {formatPropertyPrice(avgPrice)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1.5">
              Portfolio Valuation {avgPrice > 0 ? `(${formatPropertyPriceFull(avgPrice)})` : ''}
            </div>
          </div>
        </div>

        {/* Available Inventory */}
        <div
          onClick={() => setStatusFilter('AVAILABLE')}
          className={`rounded-2xl p-5 bg-white border hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] group shadow-xs cursor-pointer ${
            statusFilter === 'AVAILABLE' ? 'border-indigo-600 ring-2 ring-indigo-600/10' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available Inventory</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
              {availableCount}
            </div>
            <div className="text-[11px] text-indigo-600/90 font-medium mt-1.5">
              Ready for Buyer Tours
            </div>
          </div>
        </div>

        {/* Pending / Escrow */}
        <div
          onClick={() => setStatusFilter('UNDER_CONTRACT')}
          className={`rounded-2xl p-5 bg-white border hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] group shadow-xs cursor-pointer ${
            statusFilter === 'UNDER_CONTRACT' ? 'border-purple-600 ring-2 ring-purple-600/10' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending / Escrow</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Megaphone className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {underContractCount}
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-1.5">
              Active Transactions Linked
            </div>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Status Filter Tabs Toolbar ── */}
      <div className="rounded-2xl p-3 bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search listings by title, address, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'AVAILABLE', 'UNDER_CONTRACT', 'SOLD'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'AVAILABLE' ? 'Available' : st === 'UNDER_CONTRACT' ? 'Under Contract' : 'Sold'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content States ── */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-slate-200/90 flex flex-col items-center justify-center py-20 text-xs text-slate-500 shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-slate-900 mb-3" />
          <span>Loading MLS property inventory...</span>
        </div>
      ) : error ? (
        <div className="banner-error text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-12 text-center shadow-xs">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900">No properties in inventory</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add your first real estate listing to enable AI matching and automated CMA valuation.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-stripe-primary mt-4 text-xs bg-slate-900 hover:bg-slate-800 text-white">
            <Plus className="h-3.5 w-3.5" /> Add First Listing
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl p-5 bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-lg flex flex-col justify-between transition-all duration-200 group shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                      {p.title}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 truncate">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">{p.address}, {p.city}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                    p.status === 'AVAILABLE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {p.status}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 space-y-2.5 text-xs my-3.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
                      <Tag className="h-3.5 w-3.5 text-emerald-700" /> Asking Price:
                    </span>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-emerald-700 font-mono tracking-tight" title={formatPropertyPriceFull(p.price, p.city)}>
                        {formatPropertyPrice(p.price, p.city)}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        {formatPropertyPriceFull(p.price, p.city)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-100 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <BedDouble className="h-3.5 w-3.5 text-emerald-700" /> {p.bedrooms} Beds
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <Bath className="h-3.5 w-3.5 text-emerald-700" /> {p.bathrooms} Baths
                    </span>
                    <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[10px] uppercase font-mono tracking-wide shadow-2xs">
                      {p.propertyType}
                    </span>
                  </div>
                </div>

                {/* AI Tools Action Bar */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedMarketingProperty(p)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <Megaphone className="h-3.5 w-3.5 text-purple-600" />
                    <span>Marketing Kit</span>
                  </button>
                  <button
                    onClick={() => setSelectedCmaProperty(p)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>CMA Valuation</span>
                  </button>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                <span>ID: {p.id.slice(-8)}</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-700" /> Verified MLS
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Marketing Kit Modal */}
      {selectedMarketingProperty && (
        <PropertyMarketingModal
          property={selectedMarketingProperty}
          isOpen={!!selectedMarketingProperty}
          onClose={() => setSelectedMarketingProperty(null)}
        />
      )}

      {/* AI CMA Valuation Modal */}
      {selectedCmaProperty && (
        <PropertyCmaModal
          property={selectedCmaProperty}
          isOpen={!!selectedCmaProperty}
          onClose={() => setSelectedCmaProperty(null)}
        />
      )}

      {/* ── Add Property Modal ── */}
      {showAddModal &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddModal(false);
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl space-y-4 my-auto relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4.5 w-4.5 text-emerald-700" />
                  Add Property Listing to Inventory
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form noValidate onSubmit={handleCreateProperty} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Modern Downtown Penthouse"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (formErrors.title) setFormErrors((p) => ({ ...p, title: '' }));
                    }}
                    className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                      formErrors.title
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                    }`}
                  />
                  {formErrors.title && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {formErrors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                    <input
                      type="text"
                      placeholder="100 Main St"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (formErrors.address) setFormErrors((p) => ({ ...p, address: '' }));
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                        formErrors.address
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                      }`}
                    />
                    {formErrors.address && (
                      <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {formErrors.address}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      placeholder="Downtown"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (formErrors.city) setFormErrors((p) => ({ ...p, city: '' }));
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                        formErrors.city
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                      }`}
                    />
                    {formErrors.city && (
                      <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {formErrors.city}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Asking Price *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 15000000 or 1250000"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value ? Number(e.target.value) : '');
                        if (formErrors.price) setFormErrors((p) => ({ ...p, price: '' }));
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none transition-all ${
                        formErrors.price
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                      }`}
                    />
                    {formErrors.price && (
                      <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {formErrors.price}
                      </p>
                    )}
                    {typeof price === 'number' && price > 0 && !formErrors.price && (
                      <span className="text-[11px] text-emerald-700 font-mono mt-1 block">
                        Preview: {formatPropertyPrice(price, city)}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bedrooms (BHK) *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="e.g. 3 or 4"
                      value={bedrooms}
                      onChange={(e) => {
                        setBedrooms(e.target.value ? Number(e.target.value) : '');
                        if (formErrors.bedrooms) setFormErrors((p) => ({ ...p, bedrooms: '' }));
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none transition-all ${
                        formErrors.bedrooms
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                      }`}
                    />
                    {formErrors.bedrooms && (
                      <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {formErrors.bedrooms}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none font-medium"
                    >
                      <option value="CONDO">Condo</option>
                      <option value="SINGLE_FAMILY">Single Family</option>
                      <option value="TOWNHOUSE">Townhouse</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Listing
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── CSV Import Modal ── */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        type="properties"
        onImportSuccess={fetchProperties}
      />
    </div>
  );
}
