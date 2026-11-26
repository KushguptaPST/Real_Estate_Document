import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { CommandPalette } from '@/components/CommandPalette';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { WorkspacePageSkeleton } from '@/components/ui/skeleton';

// Route-level code-splitting for high-performance loading
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/SignupPage').then(m => ({ default: m.SignupPage })));
const UploadPage = lazy(() => import('@/pages/UploadPage').then(m => ({ default: m.UploadPage })));
const DealsPage = lazy(() => import('@/pages/DealsPage').then(m => ({ default: m.DealsPage })));
const DealDetailPage = lazy(() => import('@/pages/DealDetailPage').then(m => ({ default: m.DealDetailPage })));
const ReviewPage = lazy(() => import('@/pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then(m => ({ default: m.AuditPage })));
const NotificationSettingsPage = lazy(() => import('@/pages/NotificationSettingsPage').then(m => ({ default: m.NotificationSettingsPage })));
const AssistantPage = lazy(() => import('@/pages/AssistantPage').then(m => ({ default: m.AssistantPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const DocsPage = lazy(() => import('@/pages/DocsPage').then(m => ({ default: m.DocsPage })));
const PricingPage = lazy(() => import('@/pages/PricingPage').then(m => ({ default: m.PricingPage })));
const ContractsLibraryPage = lazy(() => import('@/pages/ContractsLibraryPage').then(m => ({ default: m.ContractsLibraryPage })));
const SecurityPage = lazy(() => import('@/pages/SecurityPage').then(m => ({ default: m.SecurityPage })));
const LeadsPage = lazy(() => import('@/pages/LeadsPage').then(m => ({ default: m.LeadsPage })));
const LeadDetailPage = lazy(() => import('@/pages/LeadDetailPage').then(m => ({ default: m.LeadDetailPage })));
const PropertiesPage = lazy(() => import('@/pages/PropertiesPage').then(m => ({ default: m.PropertiesPage })));
const OrganizationPage = lazy(() => import('@/pages/OrganizationPage').then(m => ({ default: m.OrganizationPage })));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const BillingPage = lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })));
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage').then(m => ({ default: m.CampaignsPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));

function RouteFallback() {
  return (
    <div className="p-2">
      <WorkspacePageSkeleton />
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  // Always reset scroll to top on page navigation
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-[#FAFAF8] p-6 lg:p-10">
        <WorkspacePageSkeleton />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.subscriptionStatus === 'PENDING_PAYMENT') {
    return <Navigate to="/signup" replace />;
  }

  return (
    <div className="flex h-screen h-dvh w-full overflow-hidden bg-[#FAFAF8] text-slate-900 font-sans">
      {/* 1. Permanent Left Sidebar (Locked to Viewport, Never Scrolls Away) */}
      <Sidebar />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Fixed Top Header (h-14) */}
        <TopHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

        {/* Dedicated Scrollable Content Area (scrollbar-gutter: stable prevents horizontal shift) */}
        <main
          ref={mainRef}
          style={{ scrollbarGutter: 'stable' }}
          className="flex-1 overflow-y-auto overscroll-y-contain p-6 lg:p-8 w-full"
        >
          <div className="max-w-[1600px] w-full mx-auto">
            <Breadcrumbs />
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Global Navigation Command Palette (⌘K) */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}

function AdminRouteGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F14]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.isPlatformAdmin) return <Navigate to="/deals" replace />;

  return (
    <Suspense fallback={<RouteFallback />}>
      <AdminPage />
    </Suspense>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/signup"
          element={
            user && user.subscriptionStatus !== 'PENDING_PAYMENT' ? (
              <Navigate to="/deals" replace />
            ) : (
              <SignupPage />
            )
          }
        />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={user.subscriptionStatus === 'PENDING_PAYMENT' ? '/signup' : '/deals'} replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/contracts-library" element={<ContractsLibraryPage />} />
        <Route path="/contracts" element={<Navigate to="/contracts-library" replace />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/admin" element={<AdminRouteGuard />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/knowledge" element={<Navigate to="/deals" replace />} />
          <Route path="/organization" element={<OrganizationPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:id" element={<DealDetailPage />} />
          <Route path="/deals/:id/review" element={<ReviewPage />} />
          <Route path="/deals/:id/assistant" element={<AssistantPage />} />
          <Route path="/deals/:id/notifications" element={<NotificationSettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
