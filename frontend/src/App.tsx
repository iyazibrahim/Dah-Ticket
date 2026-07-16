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
import AuditLogsPage from './pages/admin/AuditLogsPage';
import KnowledgeBasePage from './pages/knowledge/KnowledgeBasePage';
import ArticleDetailPage from './pages/knowledge/ArticleDetailPage';
import ArticleEditorPage from './pages/knowledge/ArticleEditorPage';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import MyAssetsPage from './pages/my-assets/MyAssetsPage';
import AssetRequestsPage from './pages/itam/AssetRequestsPage';
import UserSettingsPage from './pages/settings/UserSettingsPage';
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
              <Route
                path="/knowledge/new"
                element={
                  <RoleProtectedRoute guard="staff">
                    <ArticleEditorPage />
                  </RoleProtectedRoute>
                }
              />
              <Route path="/knowledge/:id" element={<ArticleDetailPage />} />
              <Route
                path="/knowledge/:id/edit"
                element={
                  <RoleProtectedRoute guard="staff">
                    <ArticleEditorPage />
                  </RoleProtectedRoute>
                }
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<UserSettingsPage />} />
              <Route path="/my-assets" element={<MyAssetsPage />} />
              <Route path="/admin/users" element={<RoleProtectedRoute guard="fullAdmin"><UsersPage /></RoleProtectedRoute>} />
              <Route path="/admin/analytics" element={<RoleProtectedRoute guard="fullAdmin"><AnalyticsPage /></RoleProtectedRoute>} />
              <Route path="/admin/audit-logs" element={<RoleProtectedRoute guard="fullAdmin"><AuditLogsPage /></RoleProtectedRoute>} />
              <Route path="/itam" element={<RoleProtectedRoute guard="staff"><ITAMDashboard /></RoleProtectedRoute>} />
              <Route path="/itam/requests" element={<RoleProtectedRoute guard="staff"><AssetRequestsPage /></RoleProtectedRoute>} />
              <Route path="/itam/scanner" element={<RoleProtectedRoute guard="staff"><AssetScannerPage /></RoleProtectedRoute>} />
              <Route path="/itam/pm" element={<RoleProtectedRoute guard="staff"><PMReportsPage /></RoleProtectedRoute>} />
              <Route path="/itam/assets" element={<RoleProtectedRoute guard="staff"><AssetListPage /></RoleProtectedRoute>} />
              <Route path="/itam/assets/new" element={<RoleProtectedRoute guard="staff"><AssetFormPage /></RoleProtectedRoute>} />
              <Route path="/itam/assets/:id" element={<RoleProtectedRoute guard="staff"><AssetDetailPage /></RoleProtectedRoute>} />
              <Route path="/itam/assets/:id/edit" element={<RoleProtectedRoute guard="staff"><AssetFormPage /></RoleProtectedRoute>} />
              <Route path="/admin/settings" element={<RoleProtectedRoute guard="fullAdmin"><ITAMSettingsPage /></RoleProtectedRoute>} />
              <Route path="/admin/itam/settings" element={<RoleProtectedRoute guard="fullAdmin"><ITAMSettingsPage /></RoleProtectedRoute>} />
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
