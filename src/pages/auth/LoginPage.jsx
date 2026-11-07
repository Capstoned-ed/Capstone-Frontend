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

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const userRole = user.role;
      if (userRole === ROLES.STUDENT) {
        navigate(ROUTES.STUDENT.DASHBOARD, { replace: true });
      } else if (userRole === ROLES.ADMIN) {
        navigate(ROUTES.ADMIN.DASHBOARD, { replace: true });
      } else if (userRole === ROLES.REGISTRAR) {
        navigate(ROUTES.REGISTRAR.DASHBOARD, { replace: true });
      } else if (userRole === ROLES.STAFF) {
        navigate(ROUTES.STAFF.DASHBOARD, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleLoginSuccess = (loggedInUser) => {
    const userRole = loggedInUser?.role;
    if (userRole === ROLES.STUDENT) {
      navigate(ROUTES.STUDENT.DASHBOARD);
    } else if (userRole === ROLES.ADMIN) {
      navigate(ROUTES.ADMIN.DASHBOARD);
    } else if (userRole === ROLES.REGISTRAR) {
      navigate(ROUTES.REGISTRAR.DASHBOARD);
    } else if (userRole === ROLES.STAFF) {
      navigate(ROUTES.STAFF.DASHBOARD);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="login-viewport">
      <div className="login-card">
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

        <div className="login-form-panel">
          <LoginForm onSuccess={handleLoginSuccess} />
        </div>
      </div>
    </div>
  );
}
