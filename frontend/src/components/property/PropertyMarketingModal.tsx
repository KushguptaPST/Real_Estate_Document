import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Check,
  Share2,
  Mail,
  FileText,
  Megaphone,
  X,
  Sparkles,
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
    description?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyMarketingModal({ property, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'INSTAGRAM' | 'EMAIL' | 'MLS' | 'FLYER'>('INSTAGRAM');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedPrice = formatPropertyPrice(property.price, property.city);
  const fullPrice = formatPropertyPriceFull(property.price, property.city);
  const priceDisplay = `${formattedPrice} (${fullPrice})`;

  // AI Generated Marketing Copy Templates
  const copyTemplates = {
    INSTAGRAM: `JUST LISTED in ${property.city}!

Step inside this stunning ${property.bedrooms} Bed, ${property.bathrooms} Bath ${property.propertyType} located at ${property.address}! 

Offered at: ${formattedPrice}

Key Highlights:
• Prime location in ${property.city}
• Spacious layout with modern finishes
• Ready for immediate move-in

Direct message us for a private showing or text "SHOWING" to book your tour today! 

#RealEstate #${property.city.replace(/[\s,\(\)]+/g, '')}Homes #JustListed #${property.propertyType.replace(/\s+/g, '')} #HomeBuying #PropertyTour #DreamHome`,

    EMAIL: `Subject: Exclusive Listing Alert: ${property.bedrooms} Bed ${property.propertyType} in ${property.city}

Hi there,

We are excited to share a brand-new listing that just hit the market in ${property.city}!

Address: ${property.address}, ${property.city}
Offered Price: ${formattedPrice}
Specs: ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms | ${property.propertyType}

Property Description:
"${property.description || `Beautiful ${property.bedrooms}-bedroom ${property.propertyType.toLowerCase()} situated in a prime ${property.city} neighborhood. Features open-concept living spaces, premium upgrades, and exceptional value.`}"

This property is expected to move fast. Click below or reply directly to schedule your private tour this weekend!

[Schedule Private Showing Today]

Best regards,
Your Dedicated Real Estate Team`,

    MLS: `STUNNING ${property.bedrooms} BEDROOM ${property.propertyType.toUpperCase()} IN PRIME ${property.city.toUpperCase()} LOCATION. Welcome to ${property.address}! This exceptionally maintained ${property.bedrooms}-bed, ${property.bathrooms}-bath property offers the perfect combination of luxury, layout, and convenience. Offered at ${formattedPrice}. Features high ceilings, abundant natural light, updated kitchen appliances, and spacious master suite. Close to top-rated schools, shopping, and dining. Don't miss this turnkey opportunity!`,

    FLYER: `EXCLUSIVE OPEN HOUSE THIS WEEKEND

${property.address}, ${property.city}
OFFERED AT ${formattedPrice}

SPECS AT A GLANCE:
• ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms
• ${property.propertyType}
• Move-in Ready Condition

Join us for our private walkthrough tour Saturday 11 AM - 2 PM!
Contact Agent for Private Entry Code & Disclosures.`,
  };

  function handleCopy(text: string, tabName: string) {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  }

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
                AI Marketing Suite
              </span>
              <span className="text-xs text-slate-500 font-medium">{property.city}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-700 shrink-0" /> {property.title}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              <span className="font-semibold text-emerald-700">{priceDisplay}</span> • {property.address}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-2.5 gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('INSTAGRAM')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'INSTAGRAM'
                ? 'border-emerald-700 text-emerald-800 font-bold bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-700" /> Social Post
          </button>
          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'EMAIL'
                ? 'border-emerald-700 text-emerald-800 font-bold bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Mail className="h-3.5 w-3.5 text-emerald-700" /> Email Blast
          </button>
          <button
            onClick={() => setActiveTab('MLS')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'MLS'
                ? 'border-emerald-700 text-emerald-800 font-bold bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-emerald-700" /> MLS Copy
          </button>
          <button
            onClick={() => setActiveTab('FLYER')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'FLYER'
                ? 'border-emerald-700 text-emerald-800 font-bold bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-700" /> Open House Flyer
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-3.5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-700" /> Generated {activeTab} Marketing Copy
            </span>

            <button
              onClick={() => handleCopy(copyTemplates[activeTab], activeTab)}
              className="px-3.5 py-1.5 rounded-xl bg-[#0A0A0A] hover:bg-black text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {copiedTab === activeTab ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedTab === activeTab ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
            </button>
          </div>

          {/* High-Contrast Light Editorial Text Surface */}
          <div className="bg-slate-50/90 text-slate-900 p-5 sm:p-6 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap border border-slate-200/90 select-all shadow-inner focus:outline-none">
            {copyTemplates[activeTab]}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
            <span>Ready to publish across social, email &amp; MLS channels</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              1-Click Formatted
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
