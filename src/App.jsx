import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { useAuth } from './hooks/useAuth';
import { ROUTES } from './constants/routes';
import { ROLES } from './constants/roles';

// Layouts & Routing Guards
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import RoleRoute from './components/routing/RoleRoute';

// Error Pages
import ForbiddenPage from './pages/error/ForbiddenPage';
import NotFoundPage from './pages/error/NotFoundPage';

// Public Auth Page
import LoginPage from './pages/auth/LoginPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import RequestDocumentPage from './pages/student/RequestDocumentPage';
import TrackStatusPage from './pages/student/TrackStatusPage';
import StudentProfilePage from './pages/student/StudentProfilePage';

// Staff & Registrar Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffRequestsPage from './pages/staff/StaffRequestsPage';
import ProcessingCalendarPage from './pages/staff/ProcessingCalendarPage';
import ReleasePage from './pages/staff/ReleasePage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import CredentialsPage from './pages/admin/CredentialsPage';
import AdminRequestsPage from './pages/admin/AdminRequestsPage';
import AdminProcessingCalendarPage from './pages/admin/ProcessingCalendarPage';

// Shared Pages
import NotificationsPage from './pages/notifications/NotificationsPage';

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B36] text-white">
        <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (user?.role === ROLES.STUDENT) {
    return <Navigate to={ROUTES.STUDENT.DASHBOARD} replace />;
  }

  if (user?.role === ROLES.ADMIN) {
    return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  }

  if (user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR) {
    return <Navigate to={ROUTES.STAFF.DASHBOARD} replace />;
  }

  return <Navigate to={ROUTES.LOGIN} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
            {/* Public Auth Routes */}
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
            <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />

            {/* Root Role Dispatcher */}
            <Route path="/" element={<RootRedirect />} />

            {/* Protected Routes inside Shared MainLayout */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              {/* Shared Authenticated Routes */}
              <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />

              {/* Student Role Routes */}
              <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT]} />}>
                <Route path={ROUTES.STUDENT.DASHBOARD} element={<StudentDashboard />} />
                <Route path={ROUTES.STUDENT.CLEARANCE} element={<Navigate to={ROUTES.STUDENT.NEW_REQUEST} replace />} />
                <Route path={ROUTES.STUDENT.NEW_REQUEST} element={<RequestDocumentPage />} />
                <Route path={ROUTES.STUDENT.REQUESTS} element={<TrackStatusPage />} />
                <Route path={ROUTES.STUDENT.CREDENTIALS} element={<Navigate to={ROUTES.STUDENT.NEW_REQUEST} replace />} />
                <Route path={ROUTES.STUDENT.PROFILE} element={<StudentProfilePage />} />
              </Route>

              {/* Staff / Registrar Role Routes (Shared Workflow, Admin also permitted) */}
              <Route element={<RoleRoute allowedRoles={[ROLES.STAFF, ROLES.REGISTRAR, ROLES.ADMIN]} />}>
                <Route path={ROUTES.STAFF.DASHBOARD} element={<StaffDashboard />} />
                <Route path={ROUTES.STAFF.CALENDAR} element={<ProcessingCalendarPage />} />
                <Route path={ROUTES.REGISTRAR.DASHBOARD} element={<Navigate to={ROUTES.STAFF.DASHBOARD} replace />} />
                <Route path={ROUTES.REGISTRAR.CALENDAR} element={<Navigate to={ROUTES.STAFF.CALENDAR} replace />} />
                <Route path={ROUTES.STAFF.REQUESTS} element={<StaffRequestsPage />} />
                <Route path={ROUTES.STAFF.VERIFICATION} element={<StaffRequestsPage />} />
                <Route path={ROUTES.STAFF.CLEARANCES} element={<Navigate to={ROUTES.STAFF.REQUESTS} replace />} />
                <Route path={ROUTES.STAFF.RELEASE} element={<ReleasePage />} />
                <Route path={ROUTES.REGISTRAR.CREDENTIALS} element={<CredentialsPage />} />
                <Route path={ROUTES.REGISTRAR.PROCESSING} element={<AdminRequestsPage />} />
              </Route>

              {/* Admin Role Routes */}
              <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
                <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
                <Route path={ROUTES.ADMIN.CALENDAR} element={<AdminProcessingCalendarPage />} />
                <Route path={ROUTES.ADMIN.USERS} element={<UserManagementPage />} />
                <Route path={ROUTES.ADMIN.CREDENTIALS} element={<CredentialsPage />} />
                <Route path={ROUTES.ADMIN.REQUESTS} element={<AdminRequestsPage />} />
              </Route>
            </Route>

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </NotificationProvider>
      </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
