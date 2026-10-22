import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  IndianRupee,
  BedDouble,
  Bath,
  Maximize2,
  X,
  Sparkles,
  BarChart3,
  Megaphone,
  FileText,
  Calendar,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';
import { PropertyCmaModal } from './PropertyCmaModal';
import { PropertyMarketingModal } from './PropertyMarketingModal';

export interface PropertyItem {
  id: string;
  title: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number | null;
  propertyType: string;
  status: 'AVAILABLE' | 'UNDER_CONTRACT' | 'SOLD' | 'OFF_MARKET' | string;
  features?: string[];
  description?: string | null;
  possessionDate?: string | null;
  createdAt?: string;
}

interface Props {
  property: PropertyItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCma?: (property: PropertyItem) => void;
  onOpenMarketing?: (property: PropertyItem) => void;
}

export function PropertyDetailModal({
  property,
  isOpen,
  onClose,
  onOpenCma,
  onOpenMarketing,
}: Props) {
  const navigate = useNavigate();
  const [showLocalCma, setShowLocalCma] = useState(false);
  const [showLocalMarketing, setShowLocalMarketing] = useState(false);

  if (!isOpen || !property) return null;

  const estSqFt = property.squareFeet || (property.bedrooms * 650 + 400);
  const pricePerSqFt = Math.round(property.price / estSqFt);

  const statusColor =
    property.status === 'AVAILABLE'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
      : property.status === 'UNDER_CONTRACT'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
      : 'bg-blue-500/10 text-blue-400 border-blue-500/25';

  const defaultAmenities = [
    '24/7 Security & Surveillance',
    'Covered Car Parking',
    'Power Backup',
    'Modern Modular Kitchen',
    'Clubhouse & Gym Access',
    'High-Speed Fiber Ready',
  ];

  const amenities =
    property.features && property.features.length > 0
      ? property.features
      : defaultAmenities;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#141418] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-6 bg-[#181820] text-white flex items-center justify-between border-b border-white/10">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="gold" className="text-[10px] tracking-wide uppercase font-mono">
                  {property.propertyType.replace(/_/g, ' ')}
                </Badge>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColor}`}>
                  {property.status.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-[#6E6E7A] font-mono">
                  ID: {property.id.slice(-8)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#F5F5F7] truncate">
                {property.title}
              </h2>
              <div className="text-xs text-[#9A9AA5] flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
                <span className="truncate">{property.address}, {property.city}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-[#6E6E7A] hover:text-[#F5F5F7] p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-160px)] custom-scrollbar">
            
            {/* Key Valuation & Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Asking Price */}
              <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] shadow-sm">
                <div className="text-[10px] font-mono text-[#9A9AA5] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <IndianRupee className="h-3.5 w-3.5 text-[#C9A961]" /> Asking Price
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono tracking-tight" title={formatIndianPriceFull(property.price)}>
                  {formatIndianPrice(property.price)}
                </div>
                <div className="text-[10px] text-[#6E6E7A] font-mono mt-0.5 truncate">
                  {formatIndianPriceFull(property.price)}
                </div>
              </div>

              {/* Space & Bed/Bath */}
              <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] shadow-sm">
                <div className="text-[10px] font-mono text-[#9A9AA5] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Maximize2 className="h-3.5 w-3.5 text-[#C9A961]" /> Layout & Space
                </div>
                <div className="text-lg font-black text-[#F5F5F7] font-mono tracking-tight">
                  {property.bedrooms} Beds · {property.bathrooms} Baths
                </div>
                <div className="text-[10px] text-[#9A9AA5] font-mono mt-0.5">
                  ~{estSqFt.toLocaleString()} sq ft (₹{pricePerSqFt.toLocaleString()}/sqft)
                </div>
              </div>

              {/* Status / Compliance */}
              <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] shadow-sm">
                <div className="text-[10px] font-mono text-[#9A9AA5] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" /> Verification
                </div>
                <div className="text-lg font-black text-[#F5F5F7] font-mono tracking-tight flex items-center gap-1.5">
                  <span className="text-emerald-400">Verified MLS</span>
                </div>
                <div className="text-[10px] text-[#6E6E7A] font-mono mt-0.5">
                  Clear Title · RERA Ready
                </div>
              </div>
            </div>

            {/* Micro-market & Description */}
            <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] space-y-2">
              <h3 className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#C9A961]" />
                Property Overview & Micro-Market Insights
              </h3>
              <p className="text-xs text-[#9A9AA5] leading-relaxed">
                {property.description ||
                  `Premium ${property.bedrooms} BHK residential listing located in ${property.address}, ${property.city}. Positioned in a high-demand micro-market with robust connectivity to key transit corridors, tech hubs, and educational institutions.`}
              </p>
            </div>

            {/* Features & Amenities */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[#C9A961]" />
                Highlights & Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181820] border border-white/[0.06] text-xs text-[#9A9AA5]"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span>{amenity}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 bg-[#181820] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onOpenCma) onOpenCma(property);
                  else setShowLocalCma(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#141418] hover:bg-[#20202A] text-xs font-semibold text-[#F5F5F7] hover:border-emerald-500/40 transition-all cursor-pointer"
              >
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                <span>CMA Valuation</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenMarketing) onOpenMarketing(property);
                  else setShowLocalMarketing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#141418] hover:bg-[#20202A] text-xs font-semibold text-[#F5F5F7] hover:border-[#C9A961]/40 transition-all cursor-pointer"
              >
                <Megaphone className="h-3.5 w-3.5 text-[#C9A961]" />
                <span>Marketing Kit</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/upload?address=${encodeURIComponent(`${property.address}, ${property.city}`)}`);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C9A961] hover:bg-[#D4B572] text-[#0A0A0B] text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Ingest Contract PDF</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Embedded CMA Modal if triggered locally */}
      {showLocalCma && (
        <PropertyCmaModal
          property={property}
          isOpen={showLocalCma}
          onClose={() => setShowLocalCma(false)}
        />
      )}

      {/* Embedded Marketing Kit Modal if triggered locally */}
      {showLocalMarketing && (
        <PropertyMarketingModal
          property={{ ...property, description: property.description ?? undefined }}
          isOpen={showLocalMarketing}
          onClose={() => setShowLocalMarketing(false)}
        />
      )}
    </>
  );
}
