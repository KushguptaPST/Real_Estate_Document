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
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { PublicHeader } from '@/components/landing/PublicHeader';

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
    name: 'NWMLS Form 21 (Washington)',
    state: 'Washington',
    code: 'NWMLS F21',
    popularIn: 'Seattle, Bellevue, Tacoma, Spokane',
    defaultDayMath: 'Calendar Days (If 5 days or less, excludes Sat/Sun/Holidays)',
    cutoffTime: '9:00 PM Pacific Standard Time',
    clauses: [
      {
        title: 'Earnest Money Deposit Delivery',
        standardDays: '2 Business Days',
        type: 'critical',
        citation: 'Section 3(b) - Delivery of Deposit',
        description: 'Buyer must deliver earnest money to Escrow Holder within 2 business days after Mutual Acceptance.',
      },
      {
        title: 'Inspection Contingency (Form 35)',
        standardDays: '10 Calendar Days',
        type: 'strict',
        citation: 'Form 35 Clause 1 - Inspection Period',
        description: 'Buyer has 10 days to conduct inspections and issue Form 35R notice to Seller before 9:00 PM cutoff.',
      },
      {
        title: 'Financing Contingency (Form 22A)',
        standardDays: '21 Calendar Days',
        type: 'critical',
        citation: 'Form 22A Clause 1 - Loan Application',
        description: 'Buyer must make full application within 5 days and obtain loan commitment within 21 days.',
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
    name: 'CAR Residential Purchase Agreement (California)',
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
        description: 'Buyer has 17 days after acceptance to complete all inspections and deliver Notice to Perform or Form CR.',
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
    name: 'FAR/BAR AS-IS Contract (Florida)',
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
        description: 'Buyer may terminate for any reason during inspection window by written notice before 5:00 PM EST.',
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
    name: 'TREC One to Four Family Contract (Texas)',
    state: 'Texas',
    code: 'TREC 20-17',
    popularIn: 'Houston, Dallas, Austin, San Antonio',
    defaultDayMath: 'Strict Calendar Days (Ending 5:00 PM Central)',
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('nwmls');

  const currentStandard = CONTRACT_STANDARDS.find((c) => c.id === activeTab) || CONTRACT_STANDARDS[0];

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A] pb-28 selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Minimalist Top Navigation ── */}
      <PublicHeader />

      {/* ── Header ── */}
      <section className="pt-28 pb-12 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] mb-5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>State Association Standards &bull; Verifiable Legal Engine</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#0A0A0A] tracking-tight">
            50-State Statutory Contract Rules
          </h1>
          <p className="mt-4 text-base text-[#4B5563] max-w-2xl mx-auto leading-relaxed">
            Eigen Estate automatically adapts day calculations, weekend roll-forward rules, and cutoffs based on official state association guidelines.
          </p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* State Tabs Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b border-[#E5E7EB]">
          {CONTRACT_STANDARDS.map((std) => {
            const isActive = activeTab === std.id;
            return (
              <button
                key={std.id}
                type="button"
                onClick={() => setActiveTab(std.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0A0A0A] text-white shadow-xs'
                    : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#F8F9FA]'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{std.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected State Standard Overview Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Summary Box */}
          <Card className="bg-white p-7 rounded-3xl border border-[#E5E7EB] lg:col-span-1 space-y-6 shadow-xs h-fit">
            <div>
              <span className="text-[11px] font-bold text-[#047857] uppercase tracking-wider bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                {currentStandard.state} Jurisdiction
              </span>
              <h2 className="text-xl font-bold text-[#0A0A0A] mt-3">{currentStandard.name}</h2>
              <p className="text-xs text-[#6B7280] mt-1">Standard form across {currentStandard.popularIn}</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#F3F4F6] text-xs">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-[#047857] mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-[#0A0A0A] block">Counting Math Rule</span>
                  <span className="text-[#6B7280] leading-relaxed">{currentStandard.defaultDayMath}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-[#047857] mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-[#0A0A0A] block">Statutory Cutoff Hour</span>
                  <span className="text-[#6B7280] leading-relaxed">{currentStandard.cutoffTime}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-[#047857] mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-[#0A0A0A] block">Verification Engine</span>
                  <span className="text-[#6B7280] leading-relaxed">Cross-checked against state legal addenda &amp; statutory holidays.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F3F4F6]">
              <Button asChild className="w-full rounded-full bg-[#0A0A0A] text-white hover:bg-[#1F2937] font-semibold text-xs py-2.5 h-10 shadow-xs">
                <Link to="/upload">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Scan {currentStandard.code} Contract
                </Link>
              </Button>
            </div>
          </Card>

          {/* Right Clause Cards Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#047857]" /> Standard Clauses &amp; Citation Map
              </h3>
              <span className="text-xs text-[#6B7280] font-mono">{currentStandard.clauses.length} Standard Clauses Indexed</span>
            </div>

            <div className="space-y-3">
              {currentStandard.clauses.map((clause, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-[#E5E7EB] hover:border-[#CBD5E1] transition-all space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#047857]" />
                      {clause.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] text-[#4B5563] font-mono font-medium px-2.5 py-0.5 rounded-full">
                        Standard: {clause.standardDays}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          clause.type === 'critical'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : 'bg-[#F8F9FA] text-[#6B7280] border border-[#E5E7EB]'
                        }`}
                      >
                        {clause.type}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#4B5563] leading-relaxed">{clause.description}</p>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#6B7280] pt-2 border-t border-[#F3F4F6]">
                    <Info className="h-3 w-3 text-[#047857]" />
                    <span>Statutory Citation: <strong className="text-[#0A0A0A]">{clause.citation}</strong></span>
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
