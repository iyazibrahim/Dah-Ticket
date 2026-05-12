import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import TicketsPage from './pages/tickets/TicketsPage';
import CreateTicketPage from './pages/tickets/CreateTicketPage';
import TicketDetailPage from './pages/tickets/TicketDetailPage';
import UsersPage from './pages/admin/UsersPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import KnowledgeBasePage from './pages/knowledge/KnowledgeBasePage';
import ProfilePage from './pages/auth/ProfilePage';
import ITAMDashboard from './pages/itam/ITAMDashboard';
import AssetListPage from './pages/itam/AssetListPage';
import AssetDetailPage from './pages/itam/AssetDetailPage';
import AssetFormPage from './pages/itam/AssetFormPage';
import ITAMSettingsPage from './pages/itam/ITAMSettingsPage';
import AssetScannerPage from './pages/itam/AssetScannerPage';
import PMReportsPage from './pages/itam/PMReportsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<CreateTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/knowledge" element={<KnowledgeBasePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
              {/* ITAM Routes */}
              <Route path="/itam" element={<ITAMDashboard />} />
              <Route path="/itam/scanner" element={<AssetScannerPage />} />
              <Route path="/itam/pm" element={<PMReportsPage />} />
              <Route path="/itam/assets" element={<AssetListPage />} />
              <Route path="/itam/assets/new" element={<AssetFormPage />} />
              <Route path="/itam/assets/:id" element={<AssetDetailPage />} />
              <Route path="/itam/assets/:id/edit" element={<AssetFormPage />} />
              <Route path="/admin/settings" element={<ITAMSettingsPage />} />
              <Route path="/admin/itam/settings" element={<ITAMSettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
