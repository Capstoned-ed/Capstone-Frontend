import React from 'react';
import { API_URL } from '../config/env';

const CURRENT_YEAR = new Date().getFullYear();

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              RQ
            </div>
            <div>
              <span className="text-lg font-semibold text-slate-900 tracking-tight">RegQuest</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Institutional Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-md border border-slate-200/80">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono">API: {API_URL}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Shell Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <main className="w-full">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-500">
          © {CURRENT_YEAR} RegQuest Capstone — Institutional Credential & Clearance Management System
        </div>
      </footer>
    </div>
  );
}
