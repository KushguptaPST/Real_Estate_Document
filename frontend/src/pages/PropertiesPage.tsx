import { useEffect, useState } from 'react';
import { propertiesApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PropertyMarketingModal } from '@/components/property/PropertyMarketingModal';
import { PropertyCmaModal } from '@/components/property/PropertyCmaModal';
import { CsvImportModal } from '@/components/CsvImportModal';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';
import {
  Building2,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  IndianRupee,
  BedDouble,
  Bath,
  MapPin,
  Sparkles,
  Megaphone,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';

export function PropertiesPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    fetchProperties();
  }, [search]);

  async function fetchProperties() {
    try {
      setLoading(true);
      setError(null);
      const data = await propertiesApi.list({ search: search || undefined });
      setProperties(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !address || !city || !price || !bedrooms) return;

    try {
      setSubmitting(true);
      await propertiesApi.create({
        title,
        address,
        city,
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
      fetchProperties();
    } catch (err: any) {
      alert(err.message || 'Failed to create property');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCount = properties.length;
  const avgPrice =
    totalCount > 0
      ? Math.round(properties.reduce((acc, p) => acc + (p.price || 0), 0) / totalCount)
      : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 shrink-0 shadow-xs">
            <Building2 className="h-5 w-5 text-[#C9A961]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F7]">
                MLS Property Inventory &amp; Valuation
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#C9A961] border border-[#C9A961]/25">
                <Sparkles className="h-3 w-3" /> MLS Grounded
              </span>
            </div>
            <p className="text-xs text-[#9A9AA5] mt-1">
              Verified property portfolio evaluated deterministically by the AI Lead Matcher and CMA Engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-stripe-secondary text-xs h-9 px-3.5 gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#C9A961]" />
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
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[136px] group shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">Total Listings</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#F5F5F7] tracking-tight">{totalCount}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#C9A961] font-semibold mt-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Active MLS Inventory</span>
            </div>
          </div>
        </div>

        {/* Average Listing Price */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[136px] group shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">Average Listing Price</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight" title={avgPrice > 0 ? formatIndianPriceFull(avgPrice) : undefined}>
              {formatIndianPrice(avgPrice)}
            </div>
            <div className="text-[11px] text-[#6E6E7A] font-mono mt-1.5">
              Portfolio Valuation {avgPrice > 0 ? `(${formatIndianPriceFull(avgPrice)})` : ''}
            </div>
          </div>
        </div>

        {/* AI Match Rate */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[136px] group shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">AI Match Rate</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/25 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#C9A961] font-mono tracking-tight">
              94.8%
            </div>
            <div className="text-[11px] text-[#C9A961]/90 font-medium mt-1.5">
              Deterministic Ranking
            </div>
          </div>
        </div>

        {/* Marketing Kits */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[136px] group shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">Marketing Kits</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/25 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Megaphone className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#F5F5F7] tracking-tight">
              Ready
            </div>
            <div className="text-[11px] text-purple-400 font-medium mt-1.5">
              Instant AI Generator
            </div>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Toolbar ── */}
      <div className="glass-panel rounded-2xl p-3 bg-[#141418] border border-white/[0.08] flex items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6E7A]" />
          <input
            type="text"
            placeholder="Search listings by title, address, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#101014] pl-10 pr-4 py-2 text-xs text-[#F5F5F7] placeholder-[#5E5E6C] focus:border-[#C9A961]/70 focus:ring-2 focus:ring-[#C9A961]/20 focus:outline-none transition-all"
          />
        </div>
        <button className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#181820] hover:bg-[#20202A] text-[#F5F5F7] px-3.5 py-2 text-xs font-semibold hover:border-[#C9A961]/40 transition-all cursor-pointer">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#C9A961]" />
          <span>Filter Options</span>
        </button>
      </div>

      {/* ── Content States ── */}
      {loading ? (
        <div className="glass-panel rounded-2xl bg-[#141418] border border-white/[0.08] flex flex-col items-center justify-center py-20 text-xs text-[#9A9AA5] shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A961] mb-3" />
          <span>Loading MLS property inventory...</span>
        </div>
      ) : error ? (
        <div className="banner-error text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="glass-panel rounded-2xl bg-[#141418] border border-dashed border-white/15 p-12 text-center">
          <Building2 className="h-12 w-12 text-[#C9A961]/50 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#F5F5F7]">No properties in inventory</h3>
          <p className="text-xs text-[#9A9AA5] mt-1 max-w-sm mx-auto">
            Add your first real estate listing to enable AI matching and automated CMA valuation.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-stripe-primary mt-4 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add First Listing
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div
              key={p.id}
              className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/40 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#F5F5F7] group-hover:text-[#C9A961] transition-colors truncate">
                      {p.title}
                    </h3>
                    <div className="text-xs text-[#9A9AA5] flex items-center gap-1.5 mt-1 truncate">
                      <MapPin className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
                      <span className="truncate">{p.address}, {p.city}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                    p.status === 'AVAILABLE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  }`}>
                    {p.status}
                  </span>
                </div>

                <div className="rounded-xl bg-[#101014] p-3.5 border border-white/[0.06] space-y-2.5 text-xs my-3.5 shadow-2xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-[#9A9AA5] text-xs font-medium">
                      <IndianRupee className="h-3.5 w-3.5 text-[#C9A961]" /> Asking Price:
                    </span>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-emerald-400 font-mono tracking-tight" title={formatIndianPriceFull(p.price)}>
                        {formatIndianPrice(p.price)}
                      </span>
                      <span className="block text-[10px] text-[#6E6E7A] font-mono">
                        {formatIndianPriceFull(p.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[#9A9AA5] pt-2 border-t border-white/[0.06] text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-[#F5F5F7]">
                      <BedDouble className="h-3.5 w-3.5 text-[#C9A961]" /> {p.bedrooms} Beds
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-[#F5F5F7]">
                      <Bath className="h-3.5 w-3.5 text-[#C9A961]" /> {p.bathrooms} Baths
                    </span>
                    <span className="font-semibold text-[#C9A961] bg-[#181820] px-2 py-0.5 rounded-md border border-[#C9A961]/25 text-[10px] uppercase font-mono tracking-wide">
                      {p.propertyType}
                    </span>
                  </div>
                </div>

                {/* AI Tools Action Bar */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedMarketingProperty(p)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#181820] text-[#F5F5F7] hover:bg-[#20202A] hover:border-[#C9A961]/40 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <Megaphone className="h-3.5 w-3.5 text-[#C9A961]" />
                    <span>Marketing Kit</span>
                  </button>
                  <button
                    onClick={() => setSelectedCmaProperty(p)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#181820] text-[#F5F5F7] hover:bg-[#20202A] hover:border-emerald-500/40 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>CMA Valuation</span>
                  </button>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] text-[10px] text-[#6E6E7A] flex items-center justify-between font-mono">
                <span>ID: {p.id.slice(-8)}</span>
                <span className="text-[#C9A961] font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-[#C9A961]" /> Verified MLS
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
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] p-6 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <h2 className="text-base font-bold text-[#F5F5F7] flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-[#C9A961]" />
                Add Property Listing to Inventory
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6E6E7A] hover:text-[#F5F5F7] transition-colors p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-3.5 text-xs">
              <div>
                <label className="label-base">Listing Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Downtown Penthouse"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="100 Main St"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Downtown"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-base">Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    placeholder="21500000 (e.g. ₹2.15 Cr)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                    className="input-base font-mono"
                  />
                  {typeof price === 'number' && price > 0 && (
                    <span className="text-[11px] text-[#C9A961] font-mono mt-1 block">
                      Preview: {formatIndianPrice(price)} ({formatIndianPriceFull(price)})
                    </span>
                  )}
                </div>
                <div>
                  <label className="label-base">Bedrooms *</label>
                  <input
                    type="number"
                    required
                    placeholder="3"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value ? Number(e.target.value) : '')}
                    className="input-base font-mono"
                  />
                </div>
                <div>
                  <label className="label-base">Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="input-base"
                  >
                    <option value="CONDO" className="bg-[#141418] text-[#F5F5F7]">Condo</option>
                    <option value="SINGLE_FAMILY" className="bg-[#141418] text-[#F5F5F7]">Single Family</option>
                    <option value="TOWNHOUSE" className="bg-[#141418] text-[#F5F5F7]">Townhouse</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-stripe-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-stripe-primary text-xs"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Listing
                </button>
              </div>
            </form>
          </div>
        </div>
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
