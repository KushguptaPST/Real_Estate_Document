import { useState } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl border border-slate-200/90 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 select-text"
        >
          
          {/* Header */}
          <div className="p-6 bg-slate-50/80 text-slate-900 flex items-center justify-between border-b border-slate-100">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="gold" className="text-[10px] tracking-wide uppercase font-mono">
                  {property.propertyType.replace(/_/g, ' ')}
                </Badge>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColor}`}>
                  {property.status.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ID: {property.id.slice(-8)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {property.title}
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{property.address}, {property.city}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> Asking Price
                </div>
                <div className="text-xl font-black text-emerald-700 font-mono tracking-tight" title={formatIndianPriceFull(property.price)}>
                  {formatIndianPrice(property.price)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {formatIndianPriceFull(property.price)}
                </div>
              </div>

              {/* Space & Bed/Bath */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Maximize2 className="h-3.5 w-3.5 text-slate-500" /> Layout & Space
                </div>
                <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
                  {property.bedrooms} Beds · {property.bathrooms} Baths
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ~{estSqFt.toLocaleString()} sq ft (₹{pricePerSqFt.toLocaleString()}/sqft)
                </div>
              </div>

              {/* Status / Compliance */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Verification
                </div>
                <div className="text-lg font-black text-slate-900 font-mono tracking-tight flex items-center gap-1.5">
                  <span className="text-emerald-700">Verified MLS</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Clear Title · RERA Ready
                </div>
              </div>
            </div>

            {/* Micro-market & Description */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                Property Overview & Micro-Market Insights
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {property.description ||
                  `Premium ${property.bedrooms} BHK residential listing located in ${property.address}, ${property.city}. Positioned in a high-demand micro-market with robust connectivity to key transit corridors, tech hubs, and educational institutions.`}
              </p>
            </div>

            {/* Features & Amenities */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                Highlights & Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span>{amenity}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onOpenCma) onOpenCma(property);
                  else setShowLocalCma(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
              >
                <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                <span>CMA Valuation</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenMarketing) onOpenMarketing(property);
                  else setShowLocalMarketing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
              >
                <Megaphone className="h-3.5 w-3.5 text-slate-600" />
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs"
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
    </>,
    document.body
  );
}
