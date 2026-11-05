import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  TrendingUp,
  Building2,
  X,
  Calculator,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { formatPropertyPrice, formatPropertyPriceFull } from '@/utils/currency';

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
  const isIndia = Boolean(
    property.city &&
      (property.city.toLowerCase().includes('bengaluru') ||
        property.city.toLowerCase().includes('bangalore') ||
        property.city.toLowerCase().includes('whitefield') ||
        property.city.toLowerCase().includes('india'))
  );

  const pricePerSqFt = Math.round(property.price / estSqFt);
  const currencySymbol = isIndia ? '₹' : '$';
  const estLowValuation = Math.round(property.price * 0.96);
  const estHighValuation = Math.round(property.price * 1.04);
  const estRentValue = Math.round(property.price * 0.0055);

  const formattedPrice = `${formatPropertyPrice(property.price, property.city)} (${formatPropertyPriceFull(property.price, property.city)})`;
  const formattedLow = formatPropertyPrice(estLowValuation, property.city);
  const formattedHigh = formatPropertyPrice(estHighValuation, property.city);
  const formattedRent = formatPropertyPrice(estRentValue, property.city);

  // Mock Nearby Comps in the same city
  const nearbyComps = [
    { address: `142 ${property.city} Blvd`, price: Math.round(property.price * 0.98), daysOnMarket: 12, sqft: estSqFt - 50 },
    { address: `88 ${property.city} Ave`, price: Math.round(property.price * 1.02), daysOnMarket: 8, sqft: estSqFt + 100 },
    { address: `210 ${property.city} Way`, price: Math.round(property.price * 0.95), daysOnMarket: 19, sqft: estSqFt - 120 },
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto relative">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-white flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                AI Automated CMA Analysis
              </span>
              <span className="text-xs text-slate-500 font-medium">{property.city} Market</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-700 shrink-0" /> Valuation &amp; Market Comps: {property.title}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              <span className="font-semibold text-emerald-700">{formattedPrice}</span> • {property.address}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Est. Market Value</span>
              <span className="text-sm font-extrabold text-slate-900 font-mono block mt-1">{formattedPrice}</span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">Target Price</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Price / Sq. Ft.</span>
              <span className="text-sm font-extrabold text-emerald-800 font-mono block mt-1">{currencySymbol}{pricePerSqFt.toLocaleString('en-US')} / sqft</span>
              <span className="text-[10px] text-slate-500 block mt-1 font-mono">Est. {estSqFt} sqft</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Valuation Range</span>
              <span className="text-xs font-bold text-slate-900 font-mono block mt-1">{formattedLow} - {formattedHigh}</span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">±4% Variance</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">Est. Monthly Rent</span>
              <span className="text-sm font-extrabold text-slate-900 font-mono block mt-1">{formattedRent} / mo</span>
              <span className="text-[10px] text-slate-500 block mt-1 font-mono">6.6% Cap Rate</span>
            </div>
          </div>

          {/* Nearby Market Comparable Sales */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-700" /> Recent Nearby Comparable Sales ({property.city})
            </h3>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Comp Address</th>
                    <th className="p-3">Sold Price</th>
                    <th className="p-3">Price / SqFt</th>
                    <th className="p-3">Days on Market</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {nearbyComps.map((comp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{comp.address}</td>
                      <td className="p-3 font-mono font-bold text-emerald-800" title={formatPropertyPriceFull(comp.price, property.city)}>
                        {formatPropertyPrice(comp.price, property.city)}
                      </td>
                      <td className="p-3 font-mono text-slate-900">{currencySymbol}{Math.round(comp.price / comp.sqft).toLocaleString('en-US')}</td>
                      <td className="p-3 font-mono text-slate-600">{comp.daysOnMarket} Days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
