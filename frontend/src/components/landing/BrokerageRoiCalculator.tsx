import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Clock,
  DollarSign,
  Calculator,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const INBOUND_LEAD_TIERS = [50, 150, 300, 600];
const ESCROW_TIERS = [15, 35, 75, 150];

export function BrokerageRoiCalculator() {
  const [monthlyLeads, setMonthlyLeads] = useState<number>(150);
  const [monthlyEscrows, setMonthlyEscrows] = useState<number>(35);

  // Financial Calculations
  // Speed-to-lead recovers ~4% more closed deals that previously went cold
  const recoveredDealsAnnual = Math.max(2, Math.round(monthlyLeads * 12 * 0.035));
  const avgCommission = 14500; // avg commission per deal (~$500k home at 2.5-3%)
  const incrementalGciAnnual = recoveredDealsAnnual * avgCommission;

  // Escrow & E&O calculations
  const annualEscrows = monthlyEscrows * 12;
  const annualProtectedPipeline = annualEscrows * 45000;
  const tcHoursSavedMonthly = Math.round(monthlyEscrows * 3.5);

  return (
    <section id="calculator" className="max-w-6xl mx-auto px-6 py-24 sm:py-28 border-t border-[#E5E7EB] space-y-12">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-100 px-3.5 py-1 text-xs font-medium tracking-wide text-zinc-700">
          <Calculator className="h-3.5 w-3.5 text-zinc-900" />
          <span>Brokerage Growth &amp; Liability Calculator</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0A0A0A] leading-[1.08]">
          Quantify your brokerage revenue &amp; risk shield.
        </h2>
        <p className="text-base text-[#52525B] leading-relaxed max-w-[60ch] mx-auto">
          Calculate the incremental GCI unlocked from sub-60s AI lead responses and the earnest money protected from statutory calendar traps.
        </p>
      </div>

      {/* Calculator Card Container */}
      <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Controls: Left Column (6 cols) */}
          <div className="lg:col-span-6 space-y-7 text-left">
            {/* Control 1: Monthly Inbound Leads */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900 font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Monthly Inbound Buyer Leads</span>
                </label>
                <span className="text-sm font-bold text-zinc-900 font-mono">
                  {monthlyLeads} Leads / Month
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {INBOUND_LEAD_TIERS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonthlyLeads(val)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      monthlyLeads === val
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-xs'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    {val} Leads
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Monthly Active Escrows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900 font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Monthly Active Escrows</span>
                </label>
                <span className="text-sm font-bold text-zinc-900 font-mono">
                  {monthlyEscrows} Deals / Month
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ESCROW_TIERS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonthlyEscrows(val)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      monthlyEscrows === val
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-xs'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    {val} Escrows
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-zinc-200 space-y-1.5 text-xs text-zinc-600">
              <div className="font-bold text-zinc-900 font-sans">Empirical Benchmark Assumptions:</div>
              <p className="text-[11px] leading-relaxed">
                71% of digital real estate leads go unanswered within 5 minutes. Converting just 3.5% of previously lost inquiries unlocks significant annual GCI, while deterministic 50-state date math eliminates E&amp;O claim deductibles ($10k&ndash;$50k).
              </p>
            </div>
          </div>

          {/* Results: Right Column (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-[#F8F9FA] border border-emerald-200/80 p-6 sm:p-7 space-y-6 text-left">
              <div className="space-y-1 border-b border-zinc-200 pb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold block">
                  Projected Brokerage Impact
                </span>
                <div className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] font-mono">
                  +${incrementalGciAnnual.toLocaleString()}
                  <span className="text-xs font-sans text-zinc-500 font-normal ml-2 block sm:inline">
                    Incremental Annual GCI
                  </span>
                </div>
              </div>

              {/* Sub Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                    Earnest Money Shielded
                  </span>
                  <strong className="text-sm font-bold text-zinc-900 font-mono block">
                    ${(annualProtectedPipeline / 1000000).toFixed(1)}M / year
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    Zero Calendar Hallucinations
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                    TC Admin Hours Recovered
                  </span>
                  <strong className="text-sm font-bold text-zinc-900 font-mono block">
                    {tcHoursSavedMonthly * 12} Hours / year
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    {tcHoursSavedMonthly} hrs/mo freed up
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-700 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Sub-60s speed-to-lead across WhatsApp, Telegram &amp; Web</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-700 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Verbatim contract citations (§4.2, Pg 4, Line 18)</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-700 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Eligible for 15% brokerage Errors &amp; Omissions insurance discount</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/pricing"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#0A0A0A] text-white hover:bg-zinc-800 transition-all font-semibold text-xs shadow-xs"
                >
                  <span>Select Brokerage Plan</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
