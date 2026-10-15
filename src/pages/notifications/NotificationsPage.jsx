import React from 'react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">
          Review updates regarding document requests, approvals, and clearance releases.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-xl mx-auto py-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 font-bold shadow-inner">
          🔔
        </div>
        <h3 className="text-lg font-bold text-slate-800">No New Notifications</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          You are up to date! Real-time alerts and clearance notifications will appear here.
        </p>
      </div>
    </div>
  );
}
