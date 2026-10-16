import { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Share2,
  Mail,
  FileText,
  Megaphone,
  X,
  CheckCircle2,
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
    description?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyMarketingModal({ property, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'INSTAGRAM' | 'EMAIL' | 'MLS' | 'FLYER'>('INSTAGRAM');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedPrice = formatIndianPrice(property.price);
  const fullPrice = formatIndianPriceFull(property.price);
  const priceDisplay = `${formattedPrice} (${fullPrice})`;


  // AI Generated Marketing Copy Templates
  const copyTemplates = {
    INSTAGRAM: `🏡 JUST LISTED in ${property.city}! ✨

Step inside this stunning ${property.bedrooms} Bed, ${property.bathrooms} Bath ${property.propertyType} located at ${property.address}! 

💰 Offered at: ${formattedPrice}

Key Highlights:
✨ Prime location in ${property.city}
✨ Spacious layout with modern finishes
✨ Ready for immediate move-in!

📲 DM us for a private showing or text "SHOWING" to book your tour today! 

#RealEstate #${property.city.replace(/\s+/g, '')}Homes #JustListed #${property.propertyType.replace(/\s+/g, '')} #HomeBuying #PropertyTour #DreamHome`,

    EMAIL: `Subject: Exclusive Listing Alert: ${property.bedrooms} Bed ${property.propertyType} in ${property.city}

Hi there,

We are excited to share a brand-new listing that just hit the market in ${property.city}!

📍 Address: ${property.address}, ${property.city}
💰 Offered Price: ${formattedPrice}
🏠 Specs: ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms | ${property.propertyType}

Property Description:
"${property.description || `Beautiful ${property.bedrooms}-bedroom ${property.propertyType.toLowerCase()} situated in a prime ${property.city} neighborhood. Features open-concept living spaces, premium upgrades, and exceptional value.`}"

This property is expected to move fast. Click below or reply directly to schedule your private tour this weekend!

[Schedule Private Showing Today]

Best regards,
Your Dedicated Real Estate Team`,

    MLS: `STUNNING ${property.bedrooms} BEDROOM ${property.propertyType.toUpperCase()} IN PRIME ${property.city.toUpperCase()} LOCATION. Welcome to ${property.address}! This exceptionally maintained ${property.bedrooms}-bed, ${property.bathrooms}-bath property offers the perfect combination of luxury, layout, and convenience. Offered at ${formattedPrice}. Features high ceilings, abundant natural light, updated kitchen appliances, and spacious master suite. Close to top-rated schools, shopping, and dining. Don't miss this turnkey opportunity!`,

    FLYER: `🔥 EXCLUSIVE OPEN HOUSE THIS WEEKEND 🔥

${property.address}, ${property.city}
OFFERED AT ${formattedPrice}

🏠 SPECS AT A GLANCE:
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-[#16161D] text-white flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="gold" className="text-[10px]">
                AI Marketing Suite
              </Badge>
              <span className="text-xs text-[#9A9AA5]">{property.city}</span>
            </div>
            <h2 className="text-lg font-bold text-[#F5F5F7] flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#C9A961]" /> {property.title}
            </h2>
            <p className="text-xs text-[#9A9AA5] font-mono mt-0.5">{priceDisplay} • {property.address}</p>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-[#6E6E7A] hover:text-[#F5F5F7] hover:bg-white/5 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#101014] px-6 pt-3 gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('INSTAGRAM')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'INSTAGRAM' ? 'border-[#C9A961] text-[#C9A961] font-bold' : 'border-transparent text-[#9A9AA5] hover:text-[#F5F5F7]'
            }`}
          >
            <Share2 className="h-4 w-4" /> Social Post
          </button>
          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'EMAIL' ? 'border-[#C9A961] text-[#C9A961] font-bold' : 'border-transparent text-[#9A9AA5] hover:text-[#F5F5F7]'
            }`}
          >
            <Mail className="h-4 w-4" /> Email Blast
          </button>
          <button
            onClick={() => setActiveTab('MLS')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'MLS' ? 'border-[#C9A961] text-[#C9A961] font-bold' : 'border-transparent text-[#9A9AA5] hover:text-[#F5F5F7]'
            }`}
          >
            <FileText className="h-4 w-4" /> MLS Copy
          </button>
          <button
            onClick={() => setActiveTab('FLYER')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'FLYER' ? 'border-[#C9A961] text-[#C9A961] font-bold' : 'border-transparent text-[#9A9AA5] hover:text-[#F5F5F7]'
            }`}
          >
            <Share2 className="h-4 w-4" /> Open House Flyer
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F5F5F7] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#C9A961]" /> Generated {activeTab} Marketing Copy
            </span>

            <button
              onClick={() => handleCopy(copyTemplates[activeTab], activeTab)}
              className="px-3 py-1.5 rounded-xl bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              {copiedTab === activeTab ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedTab === activeTab ? 'Copied to Clipboard!' : 'Copy Copy'}
            </button>
          </div>

          <div className="bg-[#0E0E12] text-[#F5F5F7] p-4 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap border border-white/10 select-all">
            {copyTemplates[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
