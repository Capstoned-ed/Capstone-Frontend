import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0B36] flex items-center justify-center p-6 text-white select-none">
      <div className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-3xl font-bold mb-5 shadow-inner">
          🔍
        </div>

        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 rounded-full mb-3">
          Error 404
        </span>

        <h1 className="text-2xl font-bold text-white mb-2">
          Page Not Found
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          The requested page or document could not be found. Please check the URL or navigate back to the home portal.
        </p>

        <button
          onClick={() => navigate(isAuthenticated ? '/' : ROUTES.LOGIN)}
          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm transition-all shadow-md active:scale-95"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}
