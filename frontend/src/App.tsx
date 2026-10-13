import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
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

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A961]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-screen bg-[#0A0A0B] text-[#F5F5F7]">
      {/* Fixed Left Vertical Sidebar */}
      <Sidebar />

      {/* Main Content Area with Sticky Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/upload" replace /> : <LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/organization" element={<OrganizationPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/deals/:id/review" element={<ReviewPage />} />
        <Route path="/deals/:id/assistant" element={<AssistantPage />} />
        <Route path="/deals/:id/notifications" element={<NotificationSettingsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contracts" element={<ContractsLibraryPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
