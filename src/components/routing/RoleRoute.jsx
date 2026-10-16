import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

/**
 * RoleRoute: Enforces Role-Based Access Control (RBAC).
 * Redirects unauthorized users directly to /403.
 * Note: Staff and Registrar share workflows and permissions per institutional requirements.
 */
export default function RoleRoute({ allowedRoles = [], children }) {
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

  const userRole = user?.role;

  // Consolidate Staff and Registrar roles
  const effectiveAllowedRoles = allowedRoles.flatMap((r) =>
    r === ROLES.STAFF || r === ROLES.REGISTRAR ? [ROLES.STAFF, ROLES.REGISTRAR] : [r]
  );

  const isAuthorized = effectiveAllowedRoles.includes(userRole);

  if (!isAuthorized) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return children ? children : <Outlet />;
}
