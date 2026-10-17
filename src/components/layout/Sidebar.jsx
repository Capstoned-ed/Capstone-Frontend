import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import logoExpanded from '../../assets/RegQuest-Logo-2-cropped.png';
import logoShrunk from '../../assets/RegQuest-Logo-3-cropped.png';
import { useNotifications } from '../../context/NotificationContext';
import StudentProfileModal from '../student/StudentProfileModal';

export default function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const userRole = user?.role;

  // Build role-specific navigation links
  const getNavLinks = () => {
    if (userRole === ROLES.STUDENT) {
      return [
        {
          label: 'Home',
          to: ROUTES.STUDENT.DASHBOARD,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
            </svg>
          ),
        },
        {
          label: 'Request Document',
          to: ROUTES.STUDENT.NEW_REQUEST,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          label: 'Track Status',
          to: ROUTES.STUDENT.REQUESTS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 2H6a2 2 0 00-2 2v7m16 0v9a2 2 0 01-2 2h-7"
              />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="14 2 14 8 20 8" />
              <circle cx="7" cy="17" r="3" strokeWidth={2} />
              <line x1="7" y1="12" x2="7" y2="13.5" strokeLinecap="round" strokeWidth={2} />
              <line x1="7" y1="20.5" x2="7" y2="22" strokeLinecap="round" strokeWidth={2} />
              <line x1="2" y1="17" x2="3.5" y2="17" strokeLinecap="round" strokeWidth={2} />
              <line x1="10.5" y1="17" x2="12" y2="17" strokeLinecap="round" strokeWidth={2} />
              <circle cx="7" cy="17" r="0.75" fill="currentColor" />
            </svg>
          ),
        },
      ];
    }

    if (userRole === ROLES.STAFF || userRole === ROLES.REGISTRAR) {
      const links = [
        {
          label: 'Home',
          to: ROUTES.STAFF.DASHBOARD,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
        {
          label: 'Process Requests',
          to: ROUTES.STAFF.REQUESTS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          label: 'Processing Calendar',
          to: ROUTES.STAFF.CALENDAR,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
              <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
              <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          ),
        },
      ];

      if (userRole === ROLES.REGISTRAR) {
        links.push(
          {
            label: 'Batch Staff Assignment',
            to: ROUTES.ADMIN.REQUESTS,
            icon: (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            ),
          },
          {
            label: 'Credential Types',
            to: ROUTES.REGISTRAR.CREDENTIALS,
            icon: (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
          }
        );
      }

      return links;
    }

    if (userRole === ROLES.ADMIN) {
      return [
        {
          label: 'Home',
          to: ROUTES.ADMIN.DASHBOARD,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
        {
          label: 'Analytics & Graphs',
          to: ROUTES.ADMIN.ANALYTICS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
        },
        {
          label: 'Processing Calendar',
          to: ROUTES.ADMIN.CALENDAR,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
              <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
              <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          ),
        },
        {
          label: 'User Management',
          to: ROUTES.ADMIN.USERS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          label: 'Batch Staff Assignment',
          to: ROUTES.ADMIN.REQUESTS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
        },
        {
          label: 'Credential Types',
          to: ROUTES.ADMIN.CREDENTIALS,
          icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ];
    }

    return [];
  };

  const navLinks = getNavLinks();

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const displayName =
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) ||
    (user?.username === '2023301564' ? 'Daisy Traya' : user?.username || 'Juan De Letchi');
  const roleDisplay = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
    : 'Student';

  return (
    <>
      <aside
        className={`relative z-30 min-h-screen bg-[#0B0B36] text-white flex flex-col justify-between transition-all duration-300 ease-in-out select-none shadow-xl ${
          isCollapsed ? 'w-[80px]' : 'w-[270px]'
        }`}
      >
        {/* Top Header Section */}
        <div>
          {isCollapsed ? (
            <div className="pt-8 pb-6 flex items-center justify-center">
              {/* Toggle Button */}
              <button
                type="button"
                onClick={onToggle}
                title="Expand Sidebar"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="9" y1="4" x2="9" y2="20" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="pt-8 pb-6 flex items-center justify-between px-6">
              {/* Expanded Sidebar Logo (RegQuest-Logo-2) */}
              <div className="flex items-center">
                <img
                  src={logoExpanded}
                  alt="RegQuest Logo"
                  className="h-9 w-auto object-contain max-w-[155px]"
                />
              </div>
              {/* Toggle Button */}
              <button
                type="button"
                onClick={onToggle}
                title="Collapse Sidebar"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="9" y1="4" x2="9" y2="20" />
                </svg>
              </button>
            </div>
          )}

          {/* Navigation Items (Middle Section) */}
          <nav className={`mt-4 space-y-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                title={isCollapsed ? (item.badge > 0 ? `${item.label} (${item.badge} unread)` : item.label) : undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-xl transition-all font-medium ${
                    isCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-4 text-[15px]'
                  } ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <div className="relative flex items-center justify-center shrink-0">
                  {item.icon}
                  {isCollapsed && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 ring-2 ring-[#0B0B36]">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Section: Notifications & User Profile */}
        <div className={`pb-8 space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {/* Notifications Item (positioned directly above the profile icon) */}
          <NavLink
            to={ROUTES.NOTIFICATIONS}
            end
            title={isCollapsed ? (unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications') : undefined}
            className={({ isActive }) =>
              `group flex items-center rounded-xl transition-all font-medium ${
                isCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-4 text-[15px]'
              } ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm font-semibold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 ring-2 ring-[#0B0B36]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            )}
          </NavLink>

          {/* User Profile Card / Toggle Button */}
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            title={isCollapsed ? `${displayName} (${roleDisplay})` : 'Profile Options'}
            className={`w-full flex items-center rounded-xl transition-all text-left ${
              isCollapsed
                ? 'justify-center p-2 hover:bg-white/10'
                : 'px-4 py-2.5 gap-4 hover:bg-white/10'
            }`}
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#64748B] flex items-center justify-center overflow-hidden flex-shrink-0 text-white shadow-inner">
              <svg className="w-7 h-7 text-white mt-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            {/* User Info (when expanded) */}
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-white truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-xs text-slate-300 font-normal capitalize mt-0.5">
                  {roleDisplay}
                </p>
              </div>
            )}
          </button>

          {/* Inline Profile Sub-menu (Rendered directly beneath profile when showUserMenu is true) */}
          {showUserMenu && (
            <div className={`space-y-1 pt-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
              {/* My Profile */}
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                title={isCollapsed ? 'My Profile' : undefined}
                className={`w-full flex items-center rounded-xl transition-all font-medium text-white/90 hover:text-white hover:bg-white/10 ${
                  isCollapsed ? 'justify-center p-3' : 'px-4 py-2.5 gap-4 text-[15px]'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </button>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                title={isCollapsed ? 'Logout' : undefined}
                className={`w-full flex items-center rounded-xl transition-all font-medium text-white/90 hover:text-white hover:bg-white/10 ${
                  isCollapsed ? 'justify-center p-3' : 'px-4 py-2.5 gap-4 text-[15px]'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                </div>
                {!isCollapsed && <span className="truncate">Logout</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Student Profile Modal matching design */}
      <StudentProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
