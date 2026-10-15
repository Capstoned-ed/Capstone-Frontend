import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/auth/LoginPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import { ROUTES } from './constants/routes';
import { ROLES } from './constants/roles';

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
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
        <Routes>
          {/* Login Page */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Role Dashboard Placeholders */}
          <Route path={ROUTES.STUDENT.DASHBOARD} element={<StudentDashboard />} />
          <Route path={ROUTES.STAFF.DASHBOARD} element={<StaffDashboard />} />
          <Route path={ROUTES.REGISTRAR.DASHBOARD} element={<StaffDashboard />} />
          <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
