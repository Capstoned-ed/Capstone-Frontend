import React from 'react';

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h2>
        <p className="text-sm text-slate-500 mt-1">
          Create, edit, and manage accounts, role assignments, and password resets.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-xl mx-auto py-12">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-3xl mx-auto mb-4 font-bold shadow-inner">
          👥
        </div>
        <h3 className="text-lg font-bold text-slate-800">Admin User Console</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          User provisioning and role administration will be implemented in <strong>Chunk 12 (Admin User Management UI)</strong>.
        </p>
      </div>
    </div>
  );
}
