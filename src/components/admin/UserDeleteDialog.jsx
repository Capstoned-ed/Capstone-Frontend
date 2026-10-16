import React, { useState } from 'react';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';

export default function UserDeleteDialog({ user, isOpen, onClose, onUserDeactivated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name
    ? user.first_name
    : user.username;

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      await usersApi.deactivate(user.id);
      toast.success(`User "${displayName}" has been deactivated.`);
      onUserDeactivated(user.id);
      onClose();
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to deactivate user.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-5 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-900 tracking-tight">
              Deactivate User Account?
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Revoke login access while preserving audit trail
            </p>
          </div>
        </div>

        {/* Dialog Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to deactivate <strong className="text-slate-900">{displayName}</strong> (<span className="text-slate-500">@{user.username}</span>)?
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-semibold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="font-semibold text-slate-800 capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Status:</span>
              <span className="font-semibold text-emerald-600">Active</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
            <span className="text-base">ℹ️</span>
            <span>
              This is a <strong>soft deactivation</strong>. The user will be blocked from logging in, but their assigned records and audit logs remain intact. You can reactivate this user at any time.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={loading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Deactivating...' : 'Deactivate User'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
