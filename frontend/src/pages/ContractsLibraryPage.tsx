import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ContractStandard {
  id: string;
  name: string;
  state: string;
  code: string;
  popularIn: string;
  defaultDayMath: string;
  cutoffTime: string;
  clauses: {
    title: string;
    standardDays: string;
    type: 'strict' | 'flexible' | 'critical';
    citation: string;
    description: string;
  }[];
}

const CONTRACT_STANDARDS: ContractStandard[] = [
  {
    id: 'nwmls',
    name: 'NWMLS Form 21',
    state: 'Washington',
    code: 'NWMLS F21',
    popularIn: 'Seattle, Bellevue, Tacoma, Spokane',
    defaultDayMath: 'Calendar Days (If 5 days or less, excludes Sat/Sun/Holidays)',
    cutoffTime: '9:00 PM Pacific Standard Time',
    clauses: [
      {
        title: 'Earnest Money Deposit',
        standardDays: '2 Business Days',
        type: 'critical',
        citation: 'Section 3(b) - Delivery of Deposit',
        description: 'Buyer must deliver earnest money to Escrow Holder within 2 days after Mutual Acceptance.',
      },
      {
        title: 'Inspection Contingency (Form 35)',
        standardDays: '10 Calendar Days',
        type: 'strict',
        citation: 'Form 35 Clause 1 - Inspection Period',
        description: 'Buyer has 10 days to conduct inspections and issue Form 35R notice to Seller.',
      },
      {
        title: 'Financing Contingency (Form 22A)',
        standardDays: '21 Calendar Days',
        type: 'critical',
        citation: 'Form 22A Clause 1 - Loan Application',
        description: 'Buyer must make full application within 5 days and obtain commitment within 21 days.',
      },
      {
        title: 'Title Review (Form 22T)',
        standardDays: '5 Calendar Days',
        type: 'flexible',
        citation: 'Form 22T Clause 2 - Title Examination',
        description: 'Buyer has 5 days after receipt of preliminary title commitment to object to encumbrances.',
      },
    ],
  },
  {
    id: 'car',
    name: 'CAR Residential Purchase Agreement (RPA)',
    state: 'California',
    code: 'CAR RPA 2026',
    popularIn: 'Los Angeles, San Francisco, San Diego, Orange County',
    defaultDayMath: 'Calendar Days (Ending at 11:59 PM)',
    cutoffTime: '11:59 PM Pacific Standard Time',
    clauses: [
      {
        title: 'Initial Deposit (EMD)',
        standardDays: '3 Calendar Days',
        type: 'critical',
        citation: 'Paragraph 3D(1) - Initial Deposit',
        description: 'Deposit to escrow within 3 business days after acceptance via wire or cashier check.',
      },
      {
        title: 'Buyer Physical Inspection',
        standardDays: '17 Calendar Days',
        type: 'strict',
        citation: 'Paragraph 14B(1) - Buyer Contingencies',
        description: 'Buyer has 17 days after acceptance to complete all inspections and deliver Notice to Perform.',
      },
      {
        title: 'Loan & Appraisal Contingency',
        standardDays: '17 Calendar Days',
        type: 'critical',
        citation: 'Paragraph 8B/8C - Financing Terms',
        description: 'Appraisal must meet purchase price and loan approval commitment must be issued.',
      },
      {
        title: 'Seller Disclosures Delivery',
        standardDays: '7 Calendar Days',
        type: 'flexible',
        citation: 'Paragraph 14A - Seller Deliveries',
        description: 'Seller must deliver TDS, SPQ, and natural hazard disclosures within 7 days.',
      },
    ],
  },
  {
    id: 'farbar',
    name: 'FAR/BAR AS-IS Contract',
    state: 'Florida',
    code: 'FAR/BAR 2026',
    popularIn: 'Miami, Orlando, Tampa, Jacksonville',
    defaultDayMath: 'Calendar Days (Excludes Weekends & National Holidays)',
    cutoffTime: '5:00 PM Eastern Standard Time',
    clauses: [
      {
        title: 'Escrow Deposit Receipt',
        standardDays: '3 Calendar Days',
        type: 'critical',
        citation: 'Section 2(a) - Initial Deposit',
        description: 'Escrow agent must provide written verification of deposit receipt within 3 days.',
      },
      {
        title: 'Inspection & Cancel Window',
        standardDays: '15 Calendar Days',
        type: 'strict',
        citation: 'Section 12 - Property Inspection',
        description: 'Buyer may terminate for any reason during inspection window by written notice before 5 PM.',
      },
      {
        title: 'Financing Approval Period',
        standardDays: '30 Calendar Days',
        type: 'critical',
        citation: 'Section 8(b) - Loan Approval',
        description: 'Buyer has 30 days to secure written loan approval and inform Seller.',
      },
    ],
  },
  {
    id: 'trec',
    name: 'TREC One to Four Family Contract',
    state: 'Texas',
    code: 'TREC 20-17',
    popularIn: 'Houston, Dallas, Austin, San Antonio',
    defaultDayMath: 'Strict Calendar Days (Ending 5:00 PM)',
    cutoffTime: '5:00 PM Central Standard Time',
    clauses: [
      {
        title: 'Earnest Money & Option Fee',
        standardDays: '3 Calendar Days',
        type: 'critical',
        citation: 'Paragraph 5 - Earnest Money',
        description: 'Buyer must deliver earnest money AND option fee to escrow agent within 3 days.',
      },
      {
        title: 'Termination Option Period',
        standardDays: '7 to 10 Days (Negotiated)',
        type: 'strict',
        citation: 'Paragraph 5B - Option Right',
        description: 'Unrestricted right to terminate contract upon payment of option fee within agreed days.',
      },
      {
        title: 'Third Party Financing Addendum',
        standardDays: '21 Calendar Days',
        type: 'critical',
        citation: 'Paragraph 2A - Financing Approval',
        description: 'Buyer must obtain buyer approval for loan terms within specified days.',
      },
    ],
  },
];

export function ContractsLibraryPage() {
  const [activeTab, setActiveTab] = useState<string>('nwmls');

  const currentStandard = CONTRACT_STANDARDS.find((c) => c.id === activeTab) || CONTRACT_STANDARDS[0];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] pb-24">
      {/* Header */}
      <section className="pt-10 pb-12 text-center border-b border-white/[0.08] bg-[#0D0D11]/60 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Badge variant="neutral" className="mb-3 bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/20 px-3.5 py-1 text-xs font-medium">
            <BookOpen className="h-3.5 w-3.5 text-[#C9A961] mr-1.5 inline" /> State Real Estate Contract Knowledge Base
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#F5F5F7] tracking-tight">
            State Contract Standards &amp; Rules Engine
          </h1>
          <p className="mt-3 text-sm text-[#9A9AA5] max-w-2xl mx-auto leading-relaxed">
            Contingency Copilot automatically adapts date calculations, weekend spillovers, and cutoff times based on official state association guidelines.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
        {/* State Tabs Navigation */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-4 border-b border-white/[0.08]">
          {CONTRACT_STANDARDS.map((std) => (
            <button
              key={std.id}
              type="button"
              onClick={() => setActiveTab(std.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === std.id
                  ? 'bg-[#C9A961] text-[#0A0A0B] shadow-sm'
                  : 'bg-[#141418] border border-white/[0.08] text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-white/20'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{std.name}</span>
              <span className="opacity-60 text-[10px]">({std.state})</span>
            </button>
          ))}
        </div>

        {/* Selected State Standard Overview Card */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Summary Box */}
          <Card className="bg-[#141418] p-6 rounded-2xl border border-white/[0.08] lg:col-span-1 space-y-5 shadow-xl">
            <div>
              <span className="text-[11px] font-semibold text-[#C9A961] uppercase tracking-wider">{currentStandard.state} Standard</span>
              <h2 className="text-2xl font-semibold text-[#F5F5F7] mt-0.5">{currentStandard.name}</h2>
              <p className="text-xs text-[#9A9AA5] mt-1">Widely used across {currentStandard.popularIn}</p>
            </div>

            <div className="space-y-3.5 pt-3 border-t border-white/[0.06] text-xs">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-[#C9A961] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-[#F5F5F7] block">Day Calculation Standard</span>
                  <span className="text-[#9A9AA5]">{currentStandard.defaultDayMath}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-[#C9A961] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-[#F5F5F7] block">Daily Cutoff Time</span>
                  <span className="text-[#9A9AA5]">{currentStandard.cutoffTime}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#34D399] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-[#F5F5F7] block">AI Validation Engine</span>
                  <span className="text-[#9A9AA5]">Cross-checked against state legal addenda &amp; Form 35/22 revisions.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <Button asChild className="w-full rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold text-xs py-2.5">
                <Link to="/upload">
                  Scan {currentStandard.name} Contract <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Right Clause Cards Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#C9A961]" /> Standard Contingency Clauses &amp; Rules
            </h3>

            <div className="space-y-3">
              {currentStandard.clauses.map((clause, idx) => (
                <div
                  key={idx}
                  className="bg-[#141418] p-5 rounded-xl border border-white/[0.08] hover:border-[#C9A961]/30 transition-all space-y-2.5 shadow-md"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                      {clause.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-[#0D0D11] border-white/[0.08] text-[#9A9AA5] font-mono">
                        Standard: {clause.standardDays}
                      </Badge>
                      <Badge
                        variant={clause.type === 'critical' ? 'destructive' : 'neutral'}
                        className={`text-[10px] ${
                          clause.type === 'critical'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                            : 'bg-white/[0.06] text-[#9A9AA5] border-white/[0.08]'
                        }`}
                      >
                        {clause.type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-[#9A9AA5] leading-relaxed">{clause.description}</p>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#6E6E7A] pt-2 border-t border-white/[0.06]">
                    <Info className="h-3 w-3 text-[#C9A961]" />
                    <span>Citation: {clause.citation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
