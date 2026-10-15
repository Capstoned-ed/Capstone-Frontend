import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0B0B36] to-[#1F1F9C] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-300 mb-3">
            System Administration
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Admin Console — Welcome, {user?.username || 'Admin'}!
          </h2>
          <p className="text-sm text-slate-200 mt-2 max-w-xl leading-relaxed">
            Manage institutional users, roles, password resets, and credential template configurations.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
            👥
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Users</p>
            <p className="text-2xl font-extrabold text-slate-800">4</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
            🔐
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Roles</p>
            <p className="text-2xl font-extrabold text-slate-800">3</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
            📜
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credentials Managed</p>
            <p className="text-2xl font-extrabold text-slate-800">8</p>
          </div>
        </div>
      </div>
    </div>
  );
}
