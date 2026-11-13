import { useState, useRef, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { CommandPalette } from '@/components/CommandPalette';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { UploadPage } from '@/pages/UploadPage';
import { DealsPage } from '@/pages/DealsPage';
import { DealDetailPage } from '@/pages/DealDetailPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { AuditPage } from '@/pages/AuditPage';
import { NotificationSettingsPage } from '@/pages/NotificationSettingsPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { DocsPage } from '@/pages/DocsPage';
import { PricingPage } from '@/pages/PricingPage';
import { ContractsLibraryPage } from '@/pages/ContractsLibraryPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { LeadDetailPage } from '@/pages/LeadDetailPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { KnowledgePage } from '@/pages/KnowledgePage';
import { OrganizationPage } from '@/pages/OrganizationPage';
import { SignupPage } from '@/pages/SignupPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { AdminPage } from '@/pages/AdminPage';

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
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-[#FAFAF8] text-slate-900 font-sans">
      {/* 1. Permanent Left Sidebar (Locked to Viewport, Never Scrolls Away) */}
      <Sidebar />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Fixed Top Header (h-14) */}
        <TopHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

        {/* Dedicated Scrollable Content Area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 lg:p-8 w-full">
          <div className="max-w-[1600px] w-full mx-auto">
            <Breadcrumbs />
            <div key={location.pathname} className="smooth-transition">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Global Navigation Command Palette (⌘K) */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={user ? <Navigate to="/deals" replace /> : <SignupPage />} />
      <Route path="/login" element={user ? <Navigate to="/deals" replace /> : <LoginPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/contracts-library" element={<ContractsLibraryPage />} />
      <Route path="/contracts" element={<Navigate to="/contracts-library" replace />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/knowledge" element={<Navigate to="/deals" replace />} />
        <Route path="/organization" element={<OrganizationPage />} />
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
  );
}
