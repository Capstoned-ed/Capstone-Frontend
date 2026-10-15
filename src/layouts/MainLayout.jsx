import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';

export default function MainLayout({ children }) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('regquest_sidebar_collapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('regquest_sidebar_collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-[#0B0B36] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg tracking-tight">RegQuest</span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-amber-300 capitalize font-medium">
            {user?.role}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10"
          title="Toggle Navigation Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile Backdrop & Slide-over Drawer */}
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
            />
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        {/* Top Institutional Bar */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-bold text-[#0B0B36] tracking-tight">
              RegQuest Institutional Portal
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              University of Science and Technology of Southern Philippines
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-amber-900 capitalize">
                {user?.role ? `${user.role} Portal` : 'Active'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Body Viewport */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children ? children : <Outlet />}
        </main>
      </div>
    </div>
  );
}
