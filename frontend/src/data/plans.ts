export type PlanTier = 'SOLO' | 'TEAM' | 'ENTERPRISE';

export interface WorkspacePlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  badgeText: string;
  monthlyPriceInr: number;
  annualMonthlyEquivalentInr: number;
  annualTotalInr: number;
  includedCreditsInr: number;
  maxSeats: number;
  maxDealsLabel: string;
  highlights: string[];
}

export const WORKSPACE_PLANS: WorkspacePlanDefinition[] = [
  {
    id: 'SOLO',
    name: 'Solo Channel Partner',
    tagline: 'For independent advisors & channel partners managing active buyer pipelines.',
    badgeText: '1 Seat',
    monthlyPriceInr: 7499,
    annualMonthlyEquivalentInr: 5999,
    annualTotalInr: 71988,
    includedCreditsInr: 6000,
    maxSeats: 1,
    maxDealsLabel: 'Up to 50 Deals',
    highlights: [
      'Telegram AI Bot channel (₹0 messaging cost)',
      'Property brochure PDF hosting & lead matching',
      'Up to 50 active escrow & contingency deals',
      'AI PDF contract extraction & deadline reminders',
      '₹6,000 included wallet credits (future voice/WA)',
    ],
  },
  {
    id: 'TEAM',
    name: 'Brokerage Team',
    tagline: 'Multi-agent workspace with role permissions, lead routing, and unlimited deals.',
    badgeText: 'Most Popular',
    monthlyPriceInr: 21999,
    annualMonthlyEquivalentInr: 17599,
    annualTotalInr: 211188,
    includedCreditsInr: 19200,
    maxSeats: 10,
    maxDealsLabel: 'Unlimited Deals',
    highlights: [
      'Up to 10 Google-verified workspace seats (Owner + Agents)',
      'Unlimited active deals, deadlines & audit logs',
      'Telegram AI Bot + CRM lead takeover & callback escalation',
      'CSV bulk lead import & agent lead privacy isolation',
      '₹19,200 included wallet credits (future voice/WA)',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise Platform',
    tagline: 'Full-scale multi-office deployment for developer mandate centers & franchises.',
    badgeText: 'Up to 100 Seats',
    monthlyPriceInr: 54999,
    annualMonthlyEquivalentInr: 43999,
    annualTotalInr: 527988,
    includedCreditsInr: 48000,
    maxSeats: 100,
    maxDealsLabel: 'Unlimited Deals',
    highlights: [
      'Up to 100 licensed team seats with Owner & Agent RBAC',
      'Unlimited deals, RERA multi-project inventory & pgvector search',
      'Tenant API keys & HMAC-SHA256 inbound webhooks',
      'Dedicated tenant audit trail & priority SLAs',
      '₹48,000 included wallet credits (future voice/WA)',
    ],
  },
];
