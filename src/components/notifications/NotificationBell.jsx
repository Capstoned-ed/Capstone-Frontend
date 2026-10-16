import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { ROUTES } from '../../constants/routes';

export default function NotificationBell({
  variant = 'dark', // 'dark' (for sidebar/mobile dark header) or 'light' (for white navbars)
  showLabel = false,
  isCollapsed = false,
  className = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const isDark = variant === 'dark';
  const isActive = location.pathname === ROUTES.NOTIFICATIONS;

  const handleClick = (e) => {
    e.preventDefault();
    navigate(ROUTES.NOTIFICATIONS);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
            : 'Notifications'
        }
        aria-label="View notifications page"
        className={`relative flex items-center transition-all cursor-pointer ${
          isDark
            ? isActive
              ? 'bg-white/20 text-white rounded-xl'
              : 'text-white/80 hover:text-white hover:bg-white/10 rounded-xl'
            : isActive
            ? 'bg-slate-200 text-[#0B0B36] rounded-xl'
            : 'text-slate-600 hover:text-[#0B0B36] hover:bg-slate-100 rounded-xl'
        } ${
          isCollapsed
            ? 'justify-center p-3 w-full'
            : showLabel
            ? 'px-4 py-3 gap-4 text-[15px] w-full font-medium'
            : 'p-2'
        }`}
      >
        {/* Bell Icon */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <span
              className={`absolute -top-1 -right-1.5 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-extrabold shadow-sm ${
                isDark
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-[#0B0B36]'
                  : 'bg-red-500 text-white ring-2 ring-white'
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* Label (if in expanded list) */}
        {showLabel && !isCollapsed && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate">Notifications</span>
            {unreadCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isDark
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-red-500 text-white'
                }`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
