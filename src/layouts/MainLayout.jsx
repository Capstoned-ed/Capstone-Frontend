import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import StudentFooter from '../components/student/StudentFooter';
import NotificationBell from '../components/notifications/NotificationBell';
import ProfileMenu from '../components/layout/ProfileMenu';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import ustpBuilding from '../assets/USTP.png';

export default function MainLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminDashboard = location.pathname === '/admin/dashboard' || location.pathname === '/registrar/dashboard';
  const isStudentDashboard = location.pathname === '/student/dashboard' || location.pathname === '/student';
  const isStaffDashboard = location.pathname === '/staff/dashboard' || location.pathname === '/staff';
  const isStudentView = location.pathname.startsWith('/student') || user?.role === 'student';

  const homeRoute =
    user?.role === ROLES.STUDENT
      ? ROUTES.STUDENT.DASHBOARD
      : user?.role === ROLES.STAFF
      ? ROUTES.STAFF.DASHBOARD
      : user?.role === ROLES.REGISTRAR
      ? ROUTES.REGISTRAR.DASHBOARD
      : user?.role === ROLES.ADMIN
      ? ROUTES.ADMIN.DASHBOARD
      : '/';

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('regquest_sidebar_collapsed');
    if (saved !== null) return JSON.parse(saved);
    return window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/registrar');
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('regquest_sidebar_collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      <header className="md:hidden bg-[#0B0B36] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10"
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link
            to={homeRoute}
            onClick={() => setMobileMenuOpen(false)}
            className="font-bold text-lg tracking-tight text-white hover:opacity-90 transition-opacity"
          >
            RegQuest
          </Link>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-amber-300 capitalize font-medium">
            {user?.role}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <NotificationBell variant="dark" dropdownPositionClass="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:top-full sm:right-0 sm:mt-2" />
          <ProfileMenu variant="dark" compact />
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[270px] bg-[#0B0B36] h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              isCollapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="hidden md:block flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-clip">
        <header className="hidden md:flex sticky top-0 z-30 relative w-full bg-[#0B0B36] text-white px-6 py-2.5 items-center justify-end gap-3 shadow-sm">
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <img
              src={ustpBuilding}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover object-right opacity-20 mix-blend-screen scale-105"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, rgba(11, 11, 54, 0.96) 0%, rgba(11, 11, 54, 0.88) 45%, rgba(11, 11, 54, 0.65) 100%)',
              }}
            />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <NotificationBell variant="dark" dropdownPositionClass="absolute top-full right-0 mt-2" />
            <ProfileMenu variant="dark" />
          </div>
        </header>

        <main className={`flex-1 w-full ${isAdminDashboard || isStudentDashboard || isStaffDashboard ? 'p-0 max-w-none' : isStudentView ? 'px-4 sm:px-8 pt-4 sm:pt-6 pb-6 max-w-7xl mx-auto' : 'p-6 sm:p-8 max-w-7xl mx-auto'}`}>
          {children ? children : <Outlet />}
        </main>

        {isStudentView && <StudentFooter />}
      </div>
    </div>
  );
}
