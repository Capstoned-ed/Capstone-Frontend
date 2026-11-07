import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import usersApi from '../../api/users';
import { getProcessedActions } from '../../api/requests';
import useToast from '../../hooks/useToast';

export default function StaffProfileModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'information' | 'password'
  const [accountUpdates, setAccountUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Editable fields state for Staff / Admin
  const [editableName, setEditableName] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [editablePhone, setEditablePhone] = useState('');
  const [editableDepartment, setEditableDepartment] = useState('Office of the University Registrar');
  const [editableOfficeLocation, setEditableOfficeLocation] = useState('Registrar Bldg, Room 102');
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password fields state (Optional)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isAdmin = user?.role === ROLES.ADMIN;
  const isRegistrar = user?.role === ROLES.REGISTRAR;

  const roleDisplay = isAdmin
    ? 'System Administrator'
    : isRegistrar
    ? 'Registrar Officer'
    : 'Registrar Staff';

  const employeeId =
    user?.employee_id ||
    user?.id_number ||
    user?.username ||
    (isAdmin ? 'ADMIN-001' : 'STAFF-001');

  const defaultDisplayName =
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (isAdmin ? 'System Administrator' : 'Registrar Staff Member');

  // Load saved staff profile from localStorage or defaults
  useEffect(() => {
    if (isOpen) {
      try {
        const staffProfiles = JSON.parse(localStorage.getItem('regquest_staff_profiles') || '{}');
        const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
        const userKey = user?.id || user?.username || employeeId;
        const profile = staffProfiles[userKey] || staffProfiles[user?.username] || {};
        const cachedUser = usersCache.find(
          (x) =>
            String(x.id) === String(user?.id || user?.userId) ||
            (x.username && user?.username && String(x.username).toLowerCase() === String(user.username).toLowerCase())
        );

        setEditableName(profile.full_name || defaultDisplayName);
        setEditableEmail(
          profile.email ||
          user?.email ||
          cachedUser?.email ||
          (isAdmin ? 'admin@ustp.edu.ph' : 'staff@ustp.edu.ph')
        );
        setEditablePhone(profile.phone || user?.phone || cachedUser?.phone || '0917-555-0199');
        setEditableDepartment(
          profile.department ||
          (isAdmin ? 'Management Information Systems (MIS)' : 'Office of the University Registrar')
        );
        setEditableOfficeLocation(
          profile.office_location ||
          (isAdmin ? 'IT Administration, 3rd Floor' : 'Registrar Administration, Ground Floor')
        );
      } catch {
        setEditableName(defaultDisplayName);
        setEditableEmail(user?.email || (isAdmin ? 'admin@ustp.edu.ph' : 'staff@ustp.edu.ph'));
        setEditablePhone('0917-555-0199');
      }
      setSaveSuccess(false);
      setPasswordError('');
      setPasswordSuccess(false);
    }
  }, [isOpen, user, defaultDisplayName, employeeId, isAdmin]);

  // Lock body scroll and ESC listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load account updates & management logs for Overview
  // STRICT RULE: Only show actions that were processed using THIS authenticated account!
  // If this account has never processed anything, display an empty log (0 count).
  useEffect(() => {
    if (isOpen) {
      setLoadingUpdates(true);

      try {
        const currentUsername = (user?.username || '').toLowerCase();
        const currentUserId = user?.id ? String(user.id) : null;

        // 1. Load requests processed by this specific account
        const processedActions = getProcessedActions(user);

        // 2. Load account provisioning actions performed by this account (e.g. if Admin)
        const customActivity = JSON.parse(localStorage.getItem('regquest_account_activity') || '[]');
        const myActivity = Array.isArray(customActivity)
          ? customActivity.filter((act) => {
              if (!act) return false;
              const actor = String(act.actor || '').toLowerCase();
              const actorId = act.actorId ? String(act.actorId) : null;
              return actor === currentUsername || (currentUserId && actorId === currentUserId);
            })
          : [];

        // Combine only actions performed by THIS account
        const combined = [...processedActions, ...myActivity];

        // Deduplicate
        const unique = [];
        const seenIds = new Set();
        combined.forEach((item) => {
          if (!item || !item.id) return;
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            unique.push(item);
          }
        });

        // Sort descending by timestamp
        unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAccountUpdates(unique);
      } catch (err) {
        console.warn('Failed to load profile account updates:', err);
        setAccountUpdates([]);
      } finally {
        setLoadingUpdates(false);
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate(ROUTES.LOGIN);
  };

  // Save changes handler for My Information
  const handleSaveInfo = (e) => {
    e?.preventDefault();

    if (!editableName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!editableEmail.trim() || !editableEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSavingInfo(true);
    try {
      const staffProfiles = JSON.parse(localStorage.getItem('regquest_staff_profiles') || '{}');
      const userKey = user?.id || user?.username || employeeId;

      const updated = {
        full_name: editableName.trim(),
        email: editableEmail.trim(),
        phone: editablePhone.trim(),
        department: editableDepartment.trim(),
        office_location: editableOfficeLocation.trim(),
        employee_id: employeeId,
        role: user?.role,
        updatedAt: new Date().toISOString(),
      };

      staffProfiles[userKey] = updated;
      if (user?.username) staffProfiles[user?.username] = updated;
      if (user?.id) staffProfiles[user?.id] = updated;

      localStorage.setItem('regquest_staff_profiles', JSON.stringify(staffProfiles));

      // Dispatch event to inform sidebar and other components
      window.dispatchEvent(new CustomEvent('regquest_profile_updated', { detail: updated }));

      setSaveSuccess(true);
      toast.success('Profile information updated successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Could not save staff profile:', err);
      toast.error('Failed to update profile information.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  // Change Password Handler (Optional)
  const handleChangePassword = (e) => {
    e?.preventDefault();
    setPasswordError('');

    if (!currentPassword.trim()) {
      setPasswordError(`Please enter your current password (default is ${employeeId}).`);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const customPasswords = JSON.parse(localStorage.getItem('regquest_custom_passwords') || '{}');
      const userKey = user?.username || employeeId || user?.id || '';

      const record = {
        originalPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (userKey) customPasswords[userKey] = record;
      if (user?.email) customPasswords[user.email.toLowerCase()] = record;
      if (employeeId) customPasswords[employeeId] = record;

      localStorage.setItem('regquest_custom_passwords', JSON.stringify(customPasswords));

      setPasswordSuccess(true);
      toast.success('Password updated successfully! You can now use your new password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      console.warn('Password change failed:', err);
      setPasswordError('Failed to save password change.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#F8F9FA] border border-slate-200/90 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col md:flex-row overflow-hidden text-slate-800 max-h-[90vh] h-[640px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Panel */}
        <div className="w-full md:w-56 lg:w-60 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-5 md:p-6 flex flex-col justify-between shrink-0">
          <div className="space-y-3">
            {/* Overview Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                activeTab === 'overview'
                  ? 'text-[#0B0B7A] font-bold bg-blue-50/70'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <span className="text-[15px]">Account Overview</span>
            </button>

            {/* My Information Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('information')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                activeTab === 'information'
                  ? 'text-[#0B0B7A] font-bold bg-blue-50/70'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="text-[15px]">My Information</span>
            </button>

            {/* Change Password Tab Button (Optional) */}
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
                activeTab === 'password'
                  ? 'text-[#0B0B7A] font-bold bg-blue-50/70'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              <span className="text-[15px]">Change Password</span>
            </button>
          </div>

          {/* Bottom Log out Button */}
          <div className="pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50/50 transition-colors text-left font-medium cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline strokeLinecap="round" strokeLinejoin="round" points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeWidth={2} />
              </svg>
              <span className="text-[15px]">Log out</span>
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col justify-start relative overflow-y-auto">
          {/* Close Button Top Right */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute top-6 right-6 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Profile Header for Admin/Staff */}
          <div className="flex items-center gap-4 pb-5 border-b border-slate-200/80">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 text-white shadow-md ${
                isAdmin
                  ? 'bg-gradient-to-tr from-purple-700 to-indigo-600'
                  : 'bg-gradient-to-tr from-[#0B0B7A] to-[#1E3A8A]'
              }`}
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                  {editableName || defaultDisplayName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-blue-100 text-[#0B0B7A] border border-blue-200'
                  }`}
                >
                  {roleDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Employee ID: <strong className="text-slate-700 font-mono">{employeeId}</strong> &bull; {editableDepartment}
              </p>
            </div>
          </div>

          {/* Tab 1: Overview (Actions Processed by this account) */}
          {activeTab === 'overview' && (
            <div className="mt-5">
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    {isAdmin ? 'Actions Processed' : 'Processed Requests'}
                  </span>
                  <div className="text-2xl font-extrabold text-[#0B0B7A]">
                    {accountUpdates.length}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {isAdmin
                      ? 'Accounts & requests managed by this account'
                      : 'Requests processed using this staff account'}
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    Role Authority
                  </span>
                  <div className="text-base font-bold text-slate-800 truncate">
                    {isAdmin ? 'Full System Admin' : 'Registrar Operations'}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
                    &bull; Active Session ({user?.username})
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    Assigned Office
                  </span>
                  <div className="text-sm font-bold text-slate-800 truncate">
                    {editableDepartment.split('(')[0].trim()}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    USTP Campus
                  </span>
                </div>
              </div>

              {/* Account Management & Updates Log Table */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#000080]">
                  {isAdmin ? 'My Account Management & Process Log' : 'My Processed Requests Log'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Account: <strong className="text-slate-700 font-mono">{user?.username}</strong>
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="overflow-x-auto max-h-[290px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                      <tr className="text-slate-800 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4 whitespace-nowrap">{isAdmin ? 'Target Account / Student' : 'Student Name'}</th>
                        <th className="py-3 px-4 whitespace-nowrap">ID / Tracking No.</th>
                        <th className="py-3 px-4 whitespace-nowrap">{isAdmin ? 'Type / Role' : 'Document Type'}</th>
                        <th className="py-3 px-4 whitespace-nowrap">Action Performed</th>
                        <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                      {loadingUpdates ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Loading activity log...
                          </td>
                        </tr>
                      ) : accountUpdates.length > 0 ? (
                        accountUpdates.map((item, idx) => {
                          const dateObj = new Date(item.timestamp);
                          const dateStr = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                          const timeStr = dateObj.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          }).toLowerCase();

                          const initial = (item.targetName || 'U').charAt(0).toUpperCase();

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              {/* Account / Student Name */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {initial}
                                  </div>
                                  <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                                    {item.targetName || 'Student'}
                                  </span>
                                </div>
                              </td>

                              {/* ID / Tracking */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {item.trackingNumber || item.targetId || 'N/A'}
                                </span>
                              </td>

                              {/* Role or Document Type */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    item.role === 'admin'
                                      ? 'bg-purple-100 text-purple-800'
                                      : item.role === 'staff' || item.role === 'registrar'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-[#0B0B7A]'
                                  }`}
                                >
                                  {item.documentType || item.role || 'Document'}
                                </span>
                              </td>

                              {/* Action Performed */}
                              <td className="py-3 px-4 text-xs sm:text-sm text-slate-700">
                                {item.action}
                              </td>

                              {/* Date & Time */}
                              <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{dateStr}</span>
                                <span className="text-slate-400 block text-[11px]">{timeStr}</span>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                              </div>
                              <p className="text-sm font-semibold text-slate-700">No processed requests or actions yet</p>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                {isAdmin
                                  ? `Accounts provisioned and requests processed using this admin account (${user?.username}) will appear here.`
                                  : `Requests and updates you process using this staff account (${user?.username}) will appear here.`}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: My Information (Staff & Admin Details) */}
          {activeTab === 'information' && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">Staff Information</h3>
              </div>

              <form
                onSubmit={handleSaveInfo}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6 md:p-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        required
                        placeholder="Enter full name"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm font-medium"
                      />
                    </div>

                    {/* Official Email */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Official Email Address
                      </label>
                      <input
                        type="email"
                        value={editableEmail}
                        onChange={(e) => setEditableEmail(e.target.value)}
                        required
                        placeholder="Enter official email"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Department / Office
                      </label>
                      <select
                        value={editableDepartment}
                        onChange={(e) => setEditableDepartment(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm cursor-pointer"
                      >
                        <option value="Office of the University Registrar">Office of the University Registrar</option>
                        <option value="Student Records & Credentials Section">Student Records & Credentials Section</option>
                        <option value="Admissions, Evaluation & Clearance Section">Admissions, Evaluation & Clearance Section</option>
                        <option value="Management Information Systems (MIS)">Management Information Systems (MIS)</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Employee ID */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Employee ID Number
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={employeeId}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-600 outline-none select-text cursor-not-allowed font-mono font-semibold"
                      />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Contact / Phone Number
                      </label>
                      <input
                        type="tel"
                        value={editablePhone}
                        onChange={(e) => setEditablePhone(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Office Location */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Office / Desk Location
                      </label>
                      <input
                        type="text"
                        value={editableOfficeLocation}
                        onChange={(e) => setEditableOfficeLocation(e.target.value)}
                        placeholder="e.g. Registrar Bldg, Room 102"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button Row */}
                <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
                  {saveSuccess && (
                    <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Changes saved!
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingInfo}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#000080] hover:bg-[#000066] text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isSavingInfo ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Change Password (Optional) */}
          {activeTab === 'password' && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">Change Password</h3>
                <span className="text-xs text-slate-500 font-medium">
                  Optional Security Setting
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6 md:p-8">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 mb-6 leading-relaxed">
                  <span className="font-semibold text-slate-800 block mb-0.5">Account Notice:</span>
                  Your default institutional password is your <strong>Employee ID</strong> (<code>{employeeId}</code>). Changing your password is fully optional. If you keep your default password, you can always log in with your Employee ID.
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 mb-5 animate-fadeIn">
                    {passwordError}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Current Password (or Employee ID)
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showCurrentPass ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showNewPass ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        minLength={6}
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPass ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex items-center gap-3">
                    {passwordSuccess && (
                      <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Password updated!
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#000080] hover:bg-[#000066] text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
