import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

/**
 * RoleRoute: Enforces strict Role-Based Access Control (RBAC).
 * Waits for AuthContext hydration (loading === false) before evaluating user role.
 * Redirects unauthorized roles strictly to /403 with zero cross-role leakage.
 */
export default function RoleRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B36] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-300">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => String(r).trim().toLowerCase());
  const isAuthorized = Boolean(normalizedUserRole) && normalizedAllowed.includes(normalizedUserRole);

  if (!isAuthorized) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return children ? children : <Outlet />;
}
