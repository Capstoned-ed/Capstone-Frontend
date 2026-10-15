import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center text-2xl font-bold mb-4">
          🛡️
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Administrator Portal</h1>
        <p className="text-sm text-slate-500 mb-6">
          Logged in as: <strong className="text-slate-800">{user?.username || 'Admin'}</strong> (Role: {user?.role})
        </p>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 mb-6 text-left space-y-1">
          <div><strong>User ID:</strong> {user?.userId}</div>
          <div><strong>Administrative Privileges:</strong> Full System Access (Chunk 12 Users, Chunk 14 Credentials)</div>
          <div><strong>Token Status:</strong> Active &amp; Valid</div>
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
