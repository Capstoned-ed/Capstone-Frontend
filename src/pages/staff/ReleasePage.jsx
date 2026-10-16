import React from 'react';

export default function ReleasePage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Document Release</h2>
        <p className="text-sm text-slate-500 mt-1">
          Finalize credential printing, claim ticket issuance, and student releases.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-xl mx-auto py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4 font-bold shadow-inner">
          📦
        </div>
        <h3 className="text-lg font-bold text-slate-800">Document Release Queue</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Staff document release procedures and tracking will be activated in upcoming sprints.
        </p>
      </div>
    </div>
  );
}
