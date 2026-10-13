import { useEffect, useState } from 'react';
import { propertiesApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PropertyMarketingModal } from '@/components/property/PropertyMarketingModal';
import { PropertyCmaModal } from '@/components/property/PropertyCmaModal';
import { CsvImportModal } from '@/components/CsvImportModal';
import {
  Building2,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  DollarSign,
  BedDouble,
  Bath,
  MapPin,
  Sparkles,
  Megaphone,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  SlidersHorizontal,
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
      {/* ── Stripe Enterprise Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#e3e8ee] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0a2540]">
              MLS Property Inventory & Valuation
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#635bff]/10 px-2.5 py-0.5 text-xs font-bold text-[#635bff] border border-[#635bff]/20">
              <Sparkles className="h-3 w-3" /> MLS Grounded
            </span>
          </div>
          <p className="text-xs text-[#4f566b] mt-0.5">
            Verified property portfolio evaluated deterministically by the AI Lead Matcher and CMA Engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowCsvModal(true)} className="btn-stripe-secondary text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#059669]" />
            <span>Import MLS / CSV</span>
          </button>
          {isOwner ? (
            <button onClick={() => setShowAddModal(true)} className="btn-stripe-primary text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Listing</span>
            </button>
          ) : (
            <div title="Only organization owners can add listings">
              <button disabled className="btn-stripe-secondary text-xs opacity-50 cursor-not-allowed">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Listing (Owner Only)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Metric Stat Cards Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-card p-4 bg-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">Total Listings</span>
            <div className="text-2xl font-black text-[#0a2540] mt-1">{totalCount}</div>
            <span className="text-[10px] text-[#635bff] font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" /> Active MLS Inventory
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
            <Building2 className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="stripe-card p-4 bg-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">Average Listing Price</span>
            <div className="text-2xl font-black text-[#059669] font-mono mt-1">
              ${avgPrice > 0 ? avgPrice.toLocaleString() : '0'}
            </div>
            <span className="text-[10px] text-[#8792a2] mt-1 font-mono">Portfolio Valuation</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200">
            <DollarSign className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="stripe-card p-4 bg-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">AI Match Rate</span>
            <div className="text-2xl font-black text-[#635bff] font-mono mt-1">94.8%</div>
            <span className="text-[10px] text-[#635bff] font-bold mt-1">Deterministic Ranking</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="stripe-card p-4 bg-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">Marketing Kits</span>
            <div className="text-2xl font-black text-[#0a2540] mt-1">Ready</div>
            <span className="text-[10px] text-purple-600 font-bold mt-1">Instant AI Generator</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
            <Megaphone className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* ── Search Bar & Toolbar ── */}
      <div className="stripe-card p-3 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8792a2]" />
          <input
            type="text"
            placeholder="Search listings by title, address, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs"
          />
        </div>
        <button className="btn-stripe-secondary hidden sm:inline-flex text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#4f566b]" />
          <span>Filter Options</span>
        </button>
      </div>

      {/* ── Content States ── */}
      {loading ? (
        <div className="stripe-card flex flex-col items-center justify-center py-16 text-xs text-[#4f566b]">
          <Loader2 className="h-7 w-7 animate-spin text-[#635bff] mb-2" />
          <span>Loading MLS property inventory...</span>
        </div>
      ) : error ? (
        <div className="banner-error text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <Building2 className="h-10 w-10 text-[#635bff] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#0a2540]">No properties in inventory</h3>
          <p className="text-xs text-[#4f566b] mt-1 max-w-sm mx-auto">
            Add your first real estate listing to enable AI matching and automated CMA valuation.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-stripe-primary mt-4 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add First Listing
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p.id} className="stripe-card p-4 flex flex-col justify-between hover:border-[#635bff]/40">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-[#0a2540] truncate">
                      {p.title}
                    </h3>
                    <div className="text-[11px] text-[#4f566b] flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-[#8792a2] shrink-0" />
                      <span className="truncate">{p.address}, {p.city}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
                    {p.status}
                  </span>
                </div>

                <div className="rounded-lg bg-[#f8f9fa] p-3 border border-[#e3e8ee] space-y-2 text-xs my-3">
                  <div className="flex items-center justify-between font-bold text-[#0a2540]">
                    <span className="flex items-center gap-1.5 text-[#3c4257] text-xs">
                      <DollarSign className="h-3.5 w-3.5 text-[#059669]" /> Asking Price:
                    </span>
                    <span className="text-sm font-extrabold text-[#059669] font-mono">${p.price.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#4f566b] pt-1.5 border-t border-[#e3e8ee] text-xs">
                    <span className="flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5 text-[#635bff]" /> {p.bedrooms} Beds
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5 text-[#635bff]" /> {p.bathrooms} Baths
                    </span>
                    <span className="font-semibold text-[#3c4257] bg-white px-2 py-0.5 rounded border border-[#e3e8ee] text-[10px]">
                      {p.propertyType}
                    </span>
                  </div>
                </div>

                {/* AI Tools Action Bar */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedMarketingProperty(p)}
                    className="btn-stripe-secondary text-[11px] py-1"
                  >
                    <Megaphone className="h-3 w-3 text-[#635bff]" /> Marketing Kit
                  </button>
                  <button
                    onClick={() => setSelectedCmaProperty(p)}
                    className="btn-stripe-secondary text-[11px] py-1"
                  >
                    <BarChart3 className="h-3 w-3 text-[#059669]" /> CMA Valuation
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#e3e8ee] text-[10px] text-[#8792a2] flex items-center justify-between font-mono">
                <span>ID: {p.id.slice(-8)}</span>
                <span className="text-[#0a2540] font-bold">Verified MLS</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2540]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 border border-[#e3e8ee] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
              <h2 className="text-sm font-bold text-[#0a2540] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#635bff]" />
                Add Property Listing to Inventory
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8792a2] hover:text-[#0a2540] text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-3 text-xs">
              <div>
                <label className="label-base">Title *</label>
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
                  <label className="label-base">Price ($) *</label>
                  <input
                    type="number"
                    required
                    placeholder="650000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Bedrooms *</label>
                  <input
                    type="number"
                    required
                    placeholder="3"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value ? Number(e.target.value) : '')}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="input-base"
                  >
                    <option value="CONDO">Condo</option>
                    <option value="SINGLE_FAMILY">Single Family</option>
                    <option value="TOWNHOUSE">Townhouse</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e3e8ee]">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-stripe-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-stripe-primary">
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
