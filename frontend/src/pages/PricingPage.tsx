import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ShieldCheck,
  Zap,
  Sparkles,
  Calculator,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [seats, setSeats] = useState(5);
  const [monthlyLeads, setMonthlyLeads] = useState(60);
  const [avgCommission, setAvgCommission] = useState(9000);

  const calculateTeamPrice = () => {
    const base = isAnnual ? 119 : 149;
    return seats * base;
  };

  // Speed-to-Lead Math (HBR Benchmark: Response under 60 seconds increases conversion by up to 391%)
  const extraDealsPerYear = Math.round((monthlyLeads * (0.65 - 0.22) * 0.04) * 12 * 10) / 10;
  const extraGciPerYear = Math.round(extraDealsPerYear * avgCommission);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] pb-24">
      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-16 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Badge variant="neutral" className="mb-4 bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/20 px-3.5 py-1 text-xs font-medium">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#C9A961] inline" />
            Transparent E&amp;O Protection Pricing
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-[#F5F5F7] sm:text-5xl lg:text-6xl">
            Protect Millions in Deals for <span className="text-[#C9A961]">a Fraction of a Single Commission</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#9A9AA5] max-w-2xl mx-auto leading-relaxed">
            One missed contingency deadline can cost $25,000+ in earnest money or spark an E&amp;O lawsuit. Choose the tier that secures your real estate transactions.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-xs sm:text-sm font-medium ${!isAnnual ? 'text-[#F5F5F7]' : 'text-[#6E6E7A]'}`}>
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border border-white/[0.1] bg-[#141418] transition-colors duration-200 ease-in-out focus:outline-none"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#C9A961] mt-0.5 ml-0.5 shadow transition duration-200 ease-in-out ${
                  isAnnual ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs sm:text-sm font-medium ${isAnnual ? 'text-[#F5F5F7]' : 'text-[#6E6E7A]'}`}>
                Annual Billing
              </span>
              <span className="rounded-full bg-[#34D399]/15 px-2 py-0.5 text-xs font-semibold text-[#34D399] border border-[#34D399]/25">
                Save 20%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Solo Agent Plan */}
          <Card className="bg-[#141418] relative flex flex-col p-8 rounded-2xl border border-white/[0.08] shadow-xl hover:border-white/20 transition-all">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-[#F5F5F7]">Solo Agent</h3>
              <p className="text-xs text-[#9A9AA5] mt-1">For active individual real estate agents</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#F5F5F7] font-mono">
                  ${isAnnual ? '39' : '49'}
                </span>
                <span className="text-sm font-medium text-[#6E6E7A]">/ agent / mo</span>
              </div>
              <p className="text-[11px] text-[#6E6E7A] mt-1">
                {isAnnual ? 'Billed annually ($468/yr)' : 'Billed monthly'}
              </p>
            </div>

            <ul className="space-y-3.5 text-xs text-[#9A9AA5] mb-8 flex-1">
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Up to 15 active deals simultaneously</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Instant PDF &amp; scanned contract OCR extraction</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>NWMLS, CAR, FAR/BAR, TREC state rules engine</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Verifiable PDF page citation deep-links</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Resend Email alerts (Agent + Client notify)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Audit trail log for basic compliance</span>
              </li>
            </ul>

            <Button asChild className="w-full rounded-full border border-white/[0.08] bg-[#0D0D11] hover:bg-white/[0.06] text-[#F5F5F7] font-medium py-2.5">
              <Link to="/upload">Start 14-Day Free Trial</Link>
            </Button>
          </Card>

          {/* Brokerage Team Plan (Featured) */}
          <Card className="bg-[#181820] relative flex flex-col p-8 rounded-2xl border-2 border-[#C9A961] shadow-2xl scale-[1.02]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-[#C9A961] text-[#0A0A0B] px-3.5 py-1 font-semibold text-xs shadow-md border-0">
                <Sparkles className="h-3 w-3 mr-1 inline" /> Most Popular for Teams
              </Badge>
            </div>

            <div className="mb-6 mt-2">
              <h3 className="text-xl font-semibold text-[#F5F5F7]">Brokerage Team</h3>
              <p className="text-xs text-[#9A9AA5] mt-1">For high-producing teams &amp; transaction coordinators</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#C9A961] font-mono">
                  ${isAnnual ? '119' : '149'}
                </span>
                <span className="text-sm font-medium text-[#6E6E7A]">/ agent / mo</span>
              </div>
              <p className="text-[11px] text-[#6E6E7A] mt-1">
                {isAnnual ? 'Billed annually' : 'Billed monthly'}
              </p>
            </div>

            <ul className="space-y-3.5 text-xs text-[#9A9AA5] mb-8 flex-1">
              <li className="flex items-center gap-2.5 font-semibold text-[#F5F5F7]">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Everything in Solo Agent, plus:</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Unlimited active deal processing</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Multi-agent shared team workspace</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Brokerage Risk Radar &amp; Analytics Dashboard</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>E&amp;O Insurance defense log exports</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Priority email &amp; SMS deadline escalation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Dedicated Transaction Coordinator workflow</span>
              </li>
            </ul>

            <Button asChild className="w-full rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold shadow-md py-2.5">
              <Link to="/upload">Get Started Now</Link>
            </Button>
          </Card>

          {/* Enterprise Shield Plan */}
          <Card className="bg-[#141418] relative flex flex-col p-8 rounded-2xl border border-white/[0.08] shadow-xl hover:border-white/20 transition-all">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-[#F5F5F7]">Enterprise Shield</h3>
              <p className="text-xs text-[#9A9AA5] mt-1">For multi-office brokerages &amp; legal compliance teams</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#F5F5F7] font-mono">Custom</span>
              </div>
              <p className="text-[11px] text-[#6E6E7A] mt-1">Tailored seat volume pricing</p>
            </div>

            <ul className="space-y-3.5 text-xs text-[#9A9AA5] mb-8 flex-1">
              <li className="flex items-center gap-2.5 font-semibold text-[#F5F5F7]">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Everything in Team Plan, plus:</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Custom state contract parser training</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Dedicated Compliance Officer approval queue</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Single Sign-On (SSO) &amp; Okta integration</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>Private Cloud or On-Premise deployment option</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-[#34D399] flex-shrink-0" />
                <span>99.99% Uptime Guarantee &amp; 1-hr SLA</span>
              </li>
            </ul>

            <Button variant="outline" asChild className="w-full rounded-full border border-white/[0.08] bg-[#0D0D11] hover:bg-white/[0.06] text-[#F5F5F7] font-medium py-2.5">
              <Link to="/docs">Contact Enterprise Sales</Link>
            </Button>
          </Card>

        </div>
      </section>

      {/* Interactive Team Estimator */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 mt-20">
        <div className="bg-[#141418] rounded-2xl p-8 border border-white/[0.08] shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#F5F5F7]">Brokerage Team Investment Calculator</h2>
              <p className="text-xs text-[#9A9AA5] mt-0.5">Adjust active agent seat count to calculate instant annual savings</p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <div className="flex justify-between items-center text-sm font-medium mb-2">
                <span className="text-[#9A9AA5] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#6E6E7A]" /> Number of Active Agents/TCs:
                </span>
                <span className="text-[#C9A961] text-base font-bold font-mono bg-[#0D0D11] px-3.5 py-1 rounded-lg border border-white/[0.08]">
                  {seats} Agents
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full h-2 bg-[#0D0D11] rounded-lg appearance-none cursor-pointer accent-[#C9A961]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0D0D11] border border-white/[0.06] text-center">
              <div>
                <p className="text-xs text-[#9A9AA5]">Monthly Team Cost</p>
                <p className="text-2xl font-bold text-[#F5F5F7] font-mono mt-1">${calculateTeamPrice()}/mo</p>
              </div>
              <div>
                <p className="text-xs text-[#9A9AA5]">Estimated Annual E&amp;O Protection Value</p>
                <p className="text-2xl font-bold text-[#34D399] font-mono mt-1">${(seats * 25000).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#9A9AA5]">Return on Investment</p>
                <p className="text-2xl font-bold text-[#C9A961] font-mono mt-1">{Math.round((seats * 25000) / (calculateTeamPrice() * 12))}x ROI</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Speed-to-Lead Revenue Calculator */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 mt-12">
        <div className="rounded-2xl p-8 border border-white/[0.08] bg-[#141418] text-[#F5F5F7] shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#F5F5F7] flex items-center gap-2">
                Speed-to-Lead Revenue Growth Engine
                <span className="text-xs font-semibold bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/25 px-2.5 py-0.5 rounded-full">
                  Harvard Business Review Benchmark
                </span>
              </h2>
              <p className="text-xs text-[#9A9AA5] mt-0.5">
                Responding to buyer inquiries under 60 seconds increases contact &amp; conversion rates by 391%.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0D0D11] p-6 rounded-xl border border-white/[0.06]">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs text-[#9A9AA5] mb-1.5">
                  <label className="font-medium">Inbound Buyer Enquiries / Month</label>
                  <span className="text-sm font-bold text-[#F5F5F7] font-mono bg-[#141418] px-2.5 py-0.5 rounded border border-white/[0.08]">
                    {monthlyLeads} leads
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={monthlyLeads}
                  onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                  className="w-full h-2 bg-[#141418] rounded-lg appearance-none cursor-pointer accent-[#C9A961]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-[#9A9AA5] mb-1.5">
                  <label className="font-medium">Avg Commission per Deal (GCI)</label>
                  <span className="text-sm font-bold text-[#F5F5F7] font-mono bg-[#141418] px-2.5 py-0.5 rounded border border-white/[0.08]">
                    ${avgCommission.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="3000"
                  max="35000"
                  step="1000"
                  value={avgCommission}
                  onChange={(e) => setAvgCommission(Number(e.target.value))}
                  className="w-full h-2 bg-[#141418] rounded-lg appearance-none cursor-pointer accent-[#C9A961]"
                />
              </div>
            </div>

            <div className="flex flex-col justify-center items-center bg-[#141418] p-5 rounded-xl border border-white/[0.06] text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#9A9AA5] mb-1">
                Estimated Additional Annual GCI
              </span>
              <div className="text-4xl font-extrabold text-[#34D399] tracking-tight font-mono">
                +${extraGciPerYear.toLocaleString()}
              </div>
              <p className="text-xs text-[#9A9AA5] mt-2">
                Yields approximately <span className="font-semibold text-[#F5F5F7]">{extraDealsPerYear} extra closed deals</span> per year from instant AI auto-replies &amp; 1-click tour booking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 mt-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-semibold text-[#F5F5F7]">Compare Plans &amp; Capabilities</h2>
          <p className="text-sm text-[#9A9AA5] mt-2">Detailed breakdown of features included across all tiers</p>
        </div>

        <div className="bg-[#141418] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#9A9AA5] border-collapse">
              <thead>
                <tr className="bg-[#0D0D11] border-b border-white/[0.08] text-[#F5F5F7] font-semibold">
                  <th className="py-4 px-6 text-sm">Feature</th>
                  <th className="py-4 px-4 text-center">Solo Agent</th>
                  <th className="py-4 px-4 text-center bg-[#C9A961]/15 text-[#C9A961]">Brokerage Team</th>
                  <th className="py-4 px-4 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">State Contract Rules (NWMLS, CAR, FAR/BAR, TREC)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02]"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">PDF Citation Deep Linking (Verifiable Page Quotes)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02]"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">Resend Real-Time Email Escalations</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02]"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">Audit Trail Export for E&amp;O Lawsuit Defense</td>
                  <td className="py-3.5 px-4 text-center text-[#6E6E7A]">Basic</td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02] font-semibold text-[#34D399]">Full Certified Log</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-[#34D399]">Enterprise Encrypted</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">Custom Brokerage Clause Parser Training</td>
                  <td className="py-3.5 px-4 text-center text-[#6E6E7A]">—</td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02] text-[#6E6E7A]">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#F5F5F7]">Single Sign-On (SSO / Okta / SAML)</td>
                  <td className="py-3.5 px-4 text-center text-[#6E6E7A]">—</td>
                  <td className="py-3.5 px-4 text-center bg-white/[0.02] text-[#6E6E7A]">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#34D399] mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
