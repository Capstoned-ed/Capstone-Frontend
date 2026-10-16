import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleReturnToDashboard = () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }

    if (user?.role === ROLES.STUDENT) {
      navigate(ROUTES.STUDENT.DASHBOARD);
    } else if (user?.role === ROLES.ADMIN) {
      navigate(ROUTES.ADMIN.DASHBOARD);
    } else if (user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR) {
      navigate(ROUTES.STAFF.DASHBOARD);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B36] flex items-center justify-center p-6 text-white select-none">
      <div className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center text-3xl font-bold mb-5 shadow-inner">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400 bg-red-500/10 rounded-full mb-3">
          Error 403
        </span>

        <h1 className="text-2xl font-bold text-white mb-2">
          Access Restricted
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          You do not have institutional authorization to access this portal with your current role{' '}
          {user?.role && (
            <span className="font-semibold text-amber-400 uppercase tracking-wide">
              ({user.role})
            </span>
          )}.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleReturnToDashboard}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm transition-all shadow-md active:scale-95"
          >
            Return to Authorized Dashboard
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate(ROUTES.LOGIN);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all border border-white/10"
          >
            Sign Out / Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}
