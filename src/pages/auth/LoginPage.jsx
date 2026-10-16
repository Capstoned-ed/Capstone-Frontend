import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import '../../styles/auth/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, force_password_change, logout } = useAuth();
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);

  const handleLoginSuccess = (loggedInUser) => {
    if (loggedInUser.force_password_change) {
      setShowForcePasswordModal(true);
      return;
    }

    // Role-based redirection
    const userRole = loggedInUser.role;
    if (userRole === ROLES.STUDENT) {
      navigate(ROUTES.STUDENT.DASHBOARD);
    } else if (userRole === ROLES.ADMIN) {
      navigate(ROUTES.ADMIN.DASHBOARD);
    } else if (userRole === ROLES.STAFF || userRole === ROLES.REGISTRAR) {
      // Staff and Registrar share workflows per institutional requirements
      navigate(ROUTES.STAFF.DASHBOARD);
    } else {
      navigate('/');
    }
  };

  // If already authenticated and force_password_change is active
  const isBlockedByPasswordChange = isAuthenticated && (force_password_change || showForcePasswordModal);

  return (
    <div className="login-viewport">
      {/* Main Centered Login Card */}
      <div className="login-card">
        {/* Left Welcome Panel (with USTP building background behind blue gradient) */}
        <div className="login-welcome-panel">
          <div className="relative z-10">
            <h2 className="login-welcome-title">
              WELCOME
            </h2>
            <h2 className="login-welcome-title mt-1">
              BACK!
            </h2>
            <p className="login-welcome-subtitle">
              Login to access your account
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="login-form-panel">
          <LoginForm onSuccess={handleLoginSuccess} />
        </div>
      </div>

      {/* Force Password Change Non-Dismissible Intercept Modal (Per Sprint 3 / Sec 5.2) */}
      {isBlockedByPasswordChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-amber-200 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center text-2xl font-bold mb-4 shadow-inner">
              🔑
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Password Change Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              Your institutional account has been flagged for a mandatory password update. Before you can access role-specific workflows, you must change your temporary password.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left mb-6">
              <span className="font-semibold block mb-1">Notice:</span>
              The self-service password change API endpoint is scheduled in <strong>Chunk 12.1</strong>. Please contact your System Administrator to perform a password update, or log out to switch accounts.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={async () => {
                  setShowForcePasswordModal(false);
                  await logout();
                  navigate(ROUTES.LOGIN);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 text-white text-xs sm:text-sm font-semibold hover:bg-slate-900 transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
