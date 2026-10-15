import React, { useState } from 'react';
import Layout from './components/Layout';
import { API_URL } from './config/env';

export default function App() {
  const [testCount, setTestCount] = useState(0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-sky-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100 mb-4">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
              Chunk 3: Init Frontend &amp; CI/CD Initialized
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              RegQuest Frontend Shell
            </h1>
            <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl">
              Vite + React with Tailwind CSS configured and integrated. This layout shell provides the foundational wrapper for upcoming authentication, role-based dashboards, and credential workflows.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 items-center">
              <button
                type="button"
                onClick={() => setTestCount((c) => c + 1)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 active:bg-sky-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                Interactive Test Button (Clicked: {testCount})
              </button>

              <span className="text-sm font-mono text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                Backend API: <span className="text-slate-800 font-semibold">{API_URL}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Feature / Acceptance Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm hover:shadow transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg mb-4">
              ⚡
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Vite + React</h2>
            <p className="text-sm text-slate-600">
              Blazing fast HMR dev server and optimized production bundling configured and verified.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm hover:shadow transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">
              🎨
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Tailwind CSS</h2>
            <p className="text-sm text-slate-600">
              Utility-first styling configured with custom themes and responsive layout presets.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm hover:shadow transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
              🚀
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">GitHub CI Pipeline</h2>
            <p className="text-sm text-slate-600">
              Automated linting and build checks configured for <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">main</code> and <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">dev</code> pull requests.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
