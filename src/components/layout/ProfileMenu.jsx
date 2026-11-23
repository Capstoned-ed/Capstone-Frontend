import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import StudentProfileModal from '../student/StudentProfileModal';
import StaffProfileModal from '../staff/StaffProfileModal';

export default function ProfileMenu({ variant = 'light', compact = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const containerRef = useRef(null);

  const userRole = user?.role;
  const isDark = variant === 'dark';

  const displayName =
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) ||
    (user?.username === '2023301564' ? 'Daisy Traya' : user?.username || 'Juan De Letchi');

  const roleDisplay =
    userRole === ROLES.REGISTRAR
      ? 'Registrar Frontdesk'
      : userRole
      ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
      : 'Student';

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <>
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          title={`${displayName} (${roleDisplay})`}
          aria-expanded={menuOpen}
          className={`flex items-center gap-2 rounded-full transition-all cursor-pointer ${
            compact ? 'p-1' : 'pl-1 pr-2.5 py-1'
          } ${
            isDark
              ? 'text-white hover:bg-white/10'
              : 'text-slate-800 hover:bg-slate-100'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
              isDark
                ? 'bg-slate-100 text-[#0B0B36] ring-2 ring-white/25'
                : 'bg-[#0B0B36] text-white ring-2 ring-slate-200/80'
            }`}
          >
            <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          {!compact && (
            <>
              <div className="text-left leading-tight max-w-[180px]">
                <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {displayName}
                </p>
                <p className={`text-[10px] font-medium capitalize truncate ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  {roleDisplay}
                </p>
              </div>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${
                  isDark ? 'text-white/80' : 'text-slate-400'
                } ${menuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 text-slate-800">
            <div className="px-3.5 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 capitalize">{roleDisplay}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setShowProfileModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0B0B36] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span>My Profile</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {userRole === ROLES.STUDENT ? (
        <StudentProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      ) : (
        <StaffProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
}
