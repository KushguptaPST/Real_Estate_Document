import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Building2,
  IndianRupee,
  CheckCircle2,
  X,
  Sparkles,
  Calculator,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';

interface Props {
  property: {
    title: string;
    address: string;
    city: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyCmaModal({ property, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const estSqFt = property.bedrooms * 650 + 400;
  const pricePerSqFt = Math.round(property.price / estSqFt);
  const estLowValuation = Math.round(property.price * 0.96);
  const estHighValuation = Math.round(property.price * 1.04);
  const estRentValue = Math.round(property.price * 0.0055);

  const formattedPrice = `${formatIndianPrice(property.price)} (${formatIndianPriceFull(property.price)})`;
  const formattedLow = formatIndianPrice(estLowValuation);
  const formattedHigh = formatIndianPrice(estHighValuation);
  const formattedRent = formatIndianPrice(estRentValue);

  // Mock Nearby Comps in the same city
  const nearbyComps = [
    { address: `142 ${property.city} Blvd`, price: Math.round(property.price * 0.98), daysOnMarket: 12, sqft: estSqFt - 50 },
    { address: `88 ${property.city} Ave`, price: Math.round(property.price * 1.02), daysOnMarket: 8, sqft: estSqFt + 100 },
    { address: `210 ${property.city} Way`, price: Math.round(property.price * 0.95), daysOnMarket: 19, sqft: estSqFt - 120 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-[#16161D] text-white flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="gold" className="text-[10px]">
                AI Automated CMA Analysis
              </Badge>
              <span className="text-xs text-[#9A9AA5]">{property.city} Market</span>
            </div>
            <h2 className="text-lg font-bold text-[#F5F5F7] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#C9A961]" /> Valuation &amp; Market Comps: {property.title}
            </h2>
            <p className="text-xs text-[#9A9AA5] font-mono mt-0.5">{formattedPrice} • {property.address}</p>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-[#6E6E7A] hover:text-[#F5F5F7] hover:bg-white/5 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#101014] border border-white/10 p-3 rounded-xl">
              <span className="text-[10px] text-[#9A9AA5] font-semibold block uppercase">Est. Market Value</span>
              <span className="text-sm font-extrabold text-[#F5F5F7] font-mono block mt-1">{formattedPrice}</span>
              <span className="text-[10px] text-[#C9A961] font-bold">🎯 Target Price</span>
            </div>

            <div className="bg-[#101014] border border-white/10 p-3 rounded-xl">
              <span className="text-[10px] text-[#9A9AA5] font-semibold block uppercase">Price / Sq. Ft.</span>
              <span className="text-sm font-extrabold text-[#C9A961] font-mono block mt-1">₹{pricePerSqFt.toLocaleString('en-IN')} / sqft</span>
              <span className="text-[10px] text-[#6E6E7A]">Est. {estSqFt} sqft</span>
            </div>

            <div className="bg-[#101014] border border-white/10 p-3 rounded-xl">
              <span className="text-[10px] text-[#9A9AA5] font-semibold block uppercase">Valuation Range</span>
              <span className="text-xs font-bold text-[#F5F5F7] font-mono block mt-1">{formattedLow} - {formattedHigh}</span>
              <span className="text-[10px] text-emerald-400 font-bold">±4% Variance</span>
            </div>

            <div className="bg-[#101014] border border-white/10 p-3 rounded-xl">
              <span className="text-[10px] text-[#9A9AA5] font-semibold block uppercase">Est. Monthly Rent</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono block mt-1">{formattedRent} / mo</span>
              <span className="text-[10px] text-[#6E6E7A]">6.6% Cap Rate</span>
            </div>
          </div>

          {/* Nearby Market Comparable Sales */}
          <div className="space-y-3">
            <h3 className="font-bold text-[#F5F5F7] flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[#C9A961]" /> Recent Nearby Comparable Sales ({property.city})
            </h3>

            <div className="rounded-xl border border-white/10 overflow-hidden bg-[#101014]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16161D] text-[#9A9AA5] font-semibold border-b border-white/10">
                  <tr>
                    <th className="p-3">Comp Address</th>
                    <th className="p-3">Sold Price</th>
                    <th className="p-3">Price / SqFt</th>
                    <th className="p-3">Days on Market</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium text-[#D0D0D8]">
                  {nearbyComps.map((comp, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 font-bold text-[#F5F5F7]">{comp.address}</td>
                      <td className="p-3 font-mono font-bold text-[#C9A961]" title={formatIndianPriceFull(comp.price)}>
                        {formatIndianPrice(comp.price)}
                      </td>
                      <td className="p-3 font-mono text-[#F5F5F7]">₹{Math.round(comp.price / comp.sqft).toLocaleString('en-IN')}</td>
                      <td className="p-3 font-mono text-[#9A9AA5]">{comp.daysOnMarket} Days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
