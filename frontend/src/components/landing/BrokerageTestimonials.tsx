import { motion } from 'framer-motion';
import { Star, ShieldCheck, Quote } from 'lucide-react';

const REVIEWS = [
  {
    quote:
      'We handle 60+ escrows concurrently across California and Washington. Manually counting business days versus calendar days and tracking local cutoffs was a nightmare before Copilot. It completely eliminated our deadline anxiety.',
    name: 'Marcus Vance',
    role: 'Lead Transaction Coordinator',
    brokerage: 'Premier TC Services &bull; 450+ Annual Closings',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
    stat: '100% On-Time Delivery',
  },
  {
    quote:
      'Our E&O insurance underwriter granted our firm a 15% policy credit after inspecting the cryptographic audit logs and verbatim contract coordinate citations. It is the gold standard for brokerage risk defense.',
    name: 'David Sterling',
    role: 'Managing Broker & Owner',
    brokerage: 'Sterling & Co. Real Estate &bull; 180+ Agents',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
    stat: '$0 Claims in 3 Years',
  },
  {
    quote:
      'In luxury transactions, missing an inspection objection by even 10 minutes can cause a buyer to forfeit a $75,000 earnest money deposit. Copilot is non-negotiable for my transaction team.',
    name: 'Elena Rostova',
    role: 'Luxury Property Specialist',
    brokerage: 'Compass Beverly Hills &bull; $52M Annual Volume',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
    stat: '$52M Volume Protected',
  },
];

export function BrokerageTestimonials() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-28 border-t border-[#E5E7EB] space-y-12">
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-100 px-3.5 py-1 text-xs font-medium tracking-wide text-zinc-700">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-900" />
          <span>Industry Validation</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0A0A0A] leading-[1.08]">
          Trusted by high-volume brokerages.
        </h2>
        <p className="text-base text-[#52525B] leading-relaxed">
          See how leading real estate teams, managing brokers, and transaction coordinators maintain flawless closing records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REVIEWS.map((r, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-current" />
                ))}
              </div>

              <blockquote className="text-sm text-zinc-700 leading-relaxed font-sans">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center gap-3">
              <img
                src={r.avatar}
                alt={r.name}
                className="h-10 w-10 rounded-full object-cover border border-zinc-200"
              />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-zinc-900 font-sans">{r.name}</h4>
                <p className="text-[11px] text-zinc-500 font-sans">{r.role}</p>
                <span className="text-[10px] text-emerald-700 font-semibold block font-mono">
                  {r.stat}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

