import React, { useState } from 'react';
import { ROLES } from '../../constants/roles';
import usersApi from '../../api/users';
import useToast from '../../hooks/useToast';

export default function UserCreateModal({ isOpen, onClose, onUserCreated }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: ROLES.STAFF,
    first_name: '',
    last_name: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side quick checks
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required.';
    if (!formData.email.trim()) newErrors.email = 'Email address is required.';
    if (!formData.password) newErrors.password = 'Temporary password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      };

      if (formData.first_name.trim()) payload.first_name = formData.first_name.trim();
      if (formData.last_name.trim()) payload.last_name = formData.last_name.trim();

      const createdUser = await usersApi.create(payload);
      toast.success(`User "${createdUser.username}" successfully provisioned.`);
      onUserCreated(createdUser);
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
        toast.error(nonFieldMsg || 'Failed to provision user. Please fix the form errors.');
      } else {
        toast.error('Network or server error provisioning user.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0B0B36] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Provision New User</h3>
              <p className="text-xs text-slate-300">Create an institutional user account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="e.g. Maria"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="e.g. Santos"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. maria_santos"
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 ${
                errors.username
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]'
              }`}
            />
            {errors.username && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{errors.username}</p>
            )}
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
              placeholder="e.g. maria.santos@ustp.edu.ph"
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 ${
                errors.email
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]'
              }`}
            />
            {errors.email && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{errors.email}</p>
            )}
          </div>

          {/* Temporary Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Temporary Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 ${
                errors.password
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]'
              }`}
            />
            {errors.password && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{errors.password}</p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              User will be flagged to change this password on their next login.
            </p>
          </div>

          {/* System Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Role <span className="text-rose-500">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0B0B36]/20 focus:border-[#0B0B36]"
            >
              <option value={ROLES.STAFF}>Staff (Operations &amp; Clearances)</option>
              <option value={ROLES.REGISTRAR}>Registrar (Credential Generation)</option>
              <option value={ROLES.ADMIN}>Administrator (Full System Access)</option>
              <option value={ROLES.STUDENT}>Student (Self-Service Portal)</option>
            </select>
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
              className="px-5 py-2 bg-[#0B0B36] hover:bg-indigo-950 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Provisioning...' : 'Provision User'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
