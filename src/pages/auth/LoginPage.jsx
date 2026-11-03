import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import '../../styles/auth/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // If already authenticated, redirect directly to role dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const userRole = user.role;
      if (userRole === ROLES.STUDENT) {
        navigate(ROUTES.STUDENT.DASHBOARD, { replace: true });
      } else if (userRole === ROLES.ADMIN) {
        navigate(ROUTES.ADMIN.DASHBOARD, { replace: true });
      } else if (userRole === ROLES.STAFF || userRole === ROLES.REGISTRAR) {
        navigate(ROUTES.STAFF.DASHBOARD, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleLoginSuccess = (loggedInUser) => {
    // Role-based redirection directly without blocking
    const userRole = loggedInUser?.role;
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
    </div>
  );
}
