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
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <Link
        to="/deals"
        className="flex items-center gap-1 text-slate-500 hover:text-emerald-700 transition-colors"
      >
        <Home className="h-3.5 w-3.5 text-slate-400" />
        <span>Home</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const label = PATH_LABELS[value] || (value.length > 16 ? `${value.slice(0, 8)}...` : value);

        return (
          <div key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-900 truncate" aria-current="page">
                {label}
              </span>
            ) : (
              <Link to={to} className="text-slate-500 hover:text-emerald-700 transition-colors truncate">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
