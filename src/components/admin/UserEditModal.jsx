import React, { useState } from 'react';
import { ROLES } from '../../constants/roles';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';

function EditUserForm({ user, onClose, onUserUpdated }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    email: user.email || '',
    role: user.role || ROLES.STAFF,
    is_active: user.is_active ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!formData.email.trim()) {
      setErrors({ email: 'Email address cannot be empty.' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email.trim(),
        role: formData.role,
        is_active: formData.is_active,
      };

      const updated = await usersApi.update(user.id, payload);
      toast.success(`User "${user.username}" updated successfully.`);
      onUserUpdated(updated);
      onClose();
    } catch (err) {
      const resData = err.response?.data;
      if (resData && typeof resData === 'object') {
        const fieldErrors = {};
        let nonFieldMsg = '';
        Object.entries(resData).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          if (key === 'non_field_errors' || key === 'detail') {
            nonFieldMsg = msg;
          } else {
            fieldErrors[key] = msg;
          }
        });
        setErrors(fieldErrors);
        toast.error(nonFieldMsg || 'Failed to update user details.');
      } else {
        toast.error('Network or server error updating user.');
      }
    } finally {
      setLoading(false);
    }
  };

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name
    ? user.first_name
    : user.username;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {/* User Summary Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">{displayName}</p>
          <p className="text-xs text-slate-500">@{user.username}</p>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            user.is_active
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {user.is_active ? 'Currently Active' : 'Currently Inactive'}
        </span>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Institutional Email <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 ${
            errors.email
              ? 'border-rose-400 focus:ring-rose-200'
              : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
          }`}
        />
        {errors.email && (
          <p className="text-xs text-rose-500 mt-1 font-medium">{errors.email}</p>
        )}
      </div>

      {/* Role Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Select Role Assignment <span className="text-rose-500">*</span>
        </label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value={ROLES.ADMIN}>Administrator (Full Console Access)</option>
          <option value={ROLES.STAFF}>Staff (Registrar Operations &amp; Verification)</option>
          <option value={ROLES.REGISTRAR}>Registrar (Document Generation)</option>
        </select>
      </div>

      {/* Active Status Checkbox */}
      <div className="pt-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700 select-none">
            Account Status is Active (Permit login access)
          </span>
        </label>
        <p className="text-[11px] text-slate-500 mt-1 pl-7">
          Unchecking this will mark the user account as Inactive without deleting data.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          <span>{loading ? 'Saving Changes...' : 'Save Role Changes'}</span>
        </button>
      </div>
    </form>
  );
}

export default function UserEditModal({ user, isOpen, onClose, onUserUpdated }) {
  if (!isOpen || !user) return null;

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name
    ? user.first_name
    : user.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#2563EB] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Change Role &amp; Access</h3>
              <p className="text-xs text-blue-100">Update account permissions for {displayName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Form initialized with key */}
        <EditUserForm
          key={user.id}
          user={user}
          onClose={onClose}
          onUserUpdated={onUserUpdated}
        />
      </div>
    </div>
  );
}
