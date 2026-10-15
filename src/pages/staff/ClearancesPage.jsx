import React from 'react';

export default function ClearancesPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clearance Approvals</h2>
        <p className="text-sm text-slate-500 mt-1">
          Sign off and validate department and institutional clearance requirements.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-xl mx-auto py-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 font-bold shadow-inner">
          🛡️
        </div>
        <h3 className="text-lg font-bold text-slate-800">Clearance Management Queue</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Staff clearance management and sign-off functionality will be active in future sprints.
        </p>
      </div>
    </div>
  );
}
