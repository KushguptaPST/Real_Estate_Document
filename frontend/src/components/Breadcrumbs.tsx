import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const PATH_LABELS: Record<string, string> = {
  leads: 'AI Leads',
  properties: 'Inventory',
  knowledge: 'Knowledge RAG',
  organization: 'Team / Org',
  deals: 'Deals & Tasks',
  upload: 'New Contract',
  audit: 'Audit Log',
  analytics: 'Analytics',
  docs: 'Documentation',
  pricing: 'Pricing',
  contracts: 'Contracts Library',
  security: 'Security',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  if (pathnames.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[#6E6E7A]">
      <Link
        to="/deals"
        className="flex items-center gap-1 text-[#9A9AA5] hover:text-[#C9A961] transition-colors"
      >
        <Home className="h-3.5 w-3.5 text-[#6E6E7A]" />
        <span>Home</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const label = PATH_LABELS[value] || (value.length > 16 ? `${value.slice(0, 8)}...` : value);

        return (
          <div key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-[#4A4A55] flex-shrink-0" />
            {isLast ? (
              <span className="font-semibold text-[#F5F5F7] truncate" aria-current="page">
                {label}
              </span>
            ) : (
              <Link to={to} className="text-[#9A9AA5] hover:text-[#C9A961] transition-colors truncate">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
