import { billingApi, dealsApi, leadsApi, organizationApi, propertiesApi, walletApi } from '@/services/api';

const prefetchedModules = new Set<string>();

function preloadOnce(key: string, loader: () => Promise<unknown>) {
  if (prefetchedModules.has(key)) return;
  prefetchedModules.add(key);
  void loader().catch(() => {
    prefetchedModules.delete(key);
  });
}

/**
 * Warms both the lazy route bundle and primary API payload when hovering a nav link.
 */
export function prefetchRoute(path: string): void {
  if (path.startsWith('/deals')) {
    preloadOnce('/deals', () => import('@/pages/DealsPage'));
    void dealsApi.prefetch();
    return;
  }
  if (path.startsWith('/leads')) {
    preloadOnce('/leads', () => import('@/pages/LeadsPage'));
    void leadsApi.prefetch();
    return;
  }
  if (path.startsWith('/properties')) {
    preloadOnce('/properties', () => import('@/pages/PropertiesPage'));
    void propertiesApi.prefetch();
    return;
  }
  if (path.startsWith('/analytics')) {
    preloadOnce('/analytics', () => import('@/pages/AnalyticsPage'));
    void dealsApi.prefetch();
    return;
  }
  if (path.startsWith('/onboarding')) {
    preloadOnce('/onboarding', () => import('@/pages/OnboardingPage'));
    void organizationApi.prefetchOnboarding();
    return;
  }
  if (path.startsWith('/organization')) {
    preloadOnce('/organization', () => import('@/pages/OrganizationPage'));
    void organizationApi.prefetchTeam();
    return;
  }
  if (path.startsWith('/billing')) {
    preloadOnce('/billing', () => import('@/pages/BillingPage'));
    void billingApi.prefetchSubscription();
    void walletApi.prefetch();
    return;
  }
  if (path.startsWith('/audit')) {
    preloadOnce('/audit', () => import('@/pages/AuditPage'));
    return;
  }
  if (path.startsWith('/campaigns')) {
    preloadOnce('/campaigns', () => import('@/pages/CampaignsPage'));
    return;
  }
  if (path.startsWith('/admin')) {
    preloadOnce('/admin', () => import('@/pages/AdminPage'));
  }
}
