import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import requestsApi from '../../api/requests';
import useToast from '../../hooks/useToast';

const getStatusBadge = (statusStr) => {
  const s = String(statusStr || 'Pending').toUpperCase();
  if (s.includes('HOLD')) {
    return 'bg-amber-100 text-amber-900 border border-amber-300';
  }
  if (s.includes('REJECT')) {
    return 'bg-rose-100 text-rose-800 border border-rose-300';
  }
  if (s.includes('CLAIM') || s.includes('COMPLET') || s.includes('RELEASED')) {
    return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  }
  if (s.includes('RELEASING') || s.includes('READY')) {
    return 'bg-purple-100 text-purple-800 border border-purple-300';
  }
  if (s.includes('FOR_PROCESSING') || s.includes('FOR PROCESSING')) {
    return 'bg-sky-100 text-sky-800 border border-sky-300';
  }
  if (s.includes('PROCESS')) {
    return 'bg-blue-100 text-blue-800 border border-blue-300';
  }
  if (s.includes('PAYMENT') || s.includes('PAY')) {
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

const formatStatus = (statusStr) => {
  const s = String(statusStr || 'Pending').trim();
  const upper = s.toUpperCase();
  if (upper === 'PENDING') return 'Pending';
  if (upper === 'FOR_PAYMENT' || upper === 'PENDING PAYMENT') return 'Pending Payment';
  if (upper === 'FOR_PROCESSING') return 'For Processing';
  if (upper === 'PROCESSING') return 'Processing';
  if (upper === 'READY_FOR_RELEASE' || upper === 'RELEASING') return 'Releasing';
  if (upper === 'RELEASED' || upper === 'CLAIMED') return 'Claimed';
  if (upper === 'ON_HOLD' || upper === 'ON HOLD') return 'On Hold';
  if (upper === 'REJECTED') return 'Rejected';
  return s;
};

export default function StudentProfileModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'information' | 'password'
  const [requestsList, setRequestsList] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Editable fields state (Email, Mobile Number, Year Level)
  const [editableEmail, setEditableEmail] = useState('');
  const [editableMobile, setEditableMobile] = useState('');
  const [editableYearLevel, setEditableYearLevel] = useState('1st year');
  const [isSaving, setIsSaving] = useState(false);
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

  // Student Identity data matching screenshot with fallbacks to authenticated user
  const displayName =
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) ||
    'Juan De Letchi';

  const studentId = user?.student_id || user?.username || '2026202666';
  const academicProgram = user?.program || 'B.S. in Information Technology';

  // Initialize editable fields on open / user change
  useEffect(() => {
    if (isOpen) {
      try {
        const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
        const usersCache = JSON.parse(localStorage.getItem('regquest_users_cache') || '[]');
        const userKey = user?.id || user?.username || user?.student_id;
        const p = profiles[userKey] || profiles[user?.username] || {};
        const cachedUser = usersCache.find(
          (x) =>
            String(x.id) === String(user?.id || user?.userId) ||
            (x.username && user?.username && String(x.username).toLowerCase() === String(user.username).toLowerCase())
        );

        const activeEmail =
          p.email ||
          user?.email ||
          cachedUser?.email ||
          (user?.username === '2023301564' ? 'daisy.traya@ustp.edu.ph' : '');

        setEditableEmail(activeEmail);
        setEditableMobile(
          p.mobile_number ||
          p.phone ||
          user?.phone ||
          user?.mobile_number ||
          cachedUser?.phone ||
          '09561236549'
        );
        setEditableYearLevel(
          p.year_level ||
          user?.year_level ||
          cachedUser?.year_level ||
          '1st year'
        );
      } catch {
        setEditableEmail(user?.email || '');
        setEditableMobile('09561236549');
        setEditableYearLevel(user?.year_level || '1st year');
      }
      setSaveSuccess(false);
    }
  }, [isOpen, user]);

  // Lock body scroll and close on ESC
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

  // Load requests when modal opens, filtered for the authenticated student only
  useEffect(() => {
    if (isOpen) {
      setLoadingRequests(true);
      requestsApi
        .list()
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            const currentUserId = user?.userId || user?.id;
            const currentStudentId = user?.student_id || user?.username;
            const currentFullName = user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '');

            const filtered = res.filter((r) => {
              if (r.user && currentUserId && String(r.user) === String(currentUserId)) return true;
              if (r.student_id && currentStudentId && String(r.student_id) === String(currentStudentId)) return true;
              if (currentStudentId && String(r.student_name || '').includes(String(currentStudentId))) return true;
              if (currentFullName && r.student_name && r.student_name.toLowerCase().includes(currentFullName.toLowerCase())) return true;
              if (user?.username && r.student_name && r.student_name.toLowerCase().includes(user.username.toLowerCase())) return true;
              return false;
            });

            setRequestsList(filtered);
          } else {
            setRequestsList([]);
          }
        })
        .catch(() => {
          setRequestsList([]);
        })
        .finally(() => {
          setLoadingRequests(false);
        });
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate(ROUTES.LOGIN);
  };

  // Save changes handler for editable fields (Email, Mobile Number, Year Level)
  const handleSaveInformation = (e) => {
    e?.preventDefault();

    if (!editableEmail || !editableEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSaving(true);
    try {
      const profiles = JSON.parse(localStorage.getItem('regquest_student_profiles') || '{}');
      const userKey = user?.id || user?.username || studentId;
      const existing = profiles[userKey] || profiles[user?.username] || {};

      const updated = {
        ...existing,
        full_name: displayName,
        student_id: studentId,
        program: academicProgram,
        email: editableEmail.trim(),
        mobile_number: editableMobile.trim(),
        phone: editableMobile.trim(),
        year_level: editableYearLevel,
      };

      profiles[userKey] = updated;
      if (user?.username) profiles[user?.username] = updated;
      if (user?.student_id) profiles[user?.student_id] = updated;
      if (user?.id) profiles[user?.id] = updated;

      localStorage.setItem('regquest_student_profiles', JSON.stringify(profiles));

      // Notify other components
      window.dispatchEvent(new CustomEvent('regquest_profile_updated', { detail: updated }));

      setSaveSuccess(true);
      toast.success('Information updated successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Could not save profile:', err);
      toast.error('Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#F8F9FA] border border-slate-200/90 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col md:flex-row overflow-hidden text-slate-800"
        style={{ minHeight: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Panel */}
        <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-5 md:p-6 flex flex-col justify-between shrink-0">
          <div className="space-y-2">
            {/* Overview Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-[#0B0B7A] bg-indigo-50/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
              </svg>
              <span className="text-[15px] whitespace-nowrap">Overview</span>
            </button>

            {/* My Information Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('information')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'information'
                  ? 'text-[#0B0B7A] bg-indigo-50/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[15px] whitespace-nowrap">My Information</span>
            </button>

            {/* Change Password Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'password'
                  ? 'text-[#0B0B7A] bg-indigo-50/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              <span className="text-[15px] whitespace-nowrap">Change Password</span>
            </button>
          </div>

          {/* Bottom Log out Button */}
          <div className="pt-6">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50/60 transition-colors text-left font-medium cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline strokeLinecap="round" strokeLinejoin="round" points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeWidth={2} />
              </svg>
              <span className="text-[15px] whitespace-nowrap">Log out</span>
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 p-6 sm:p-8 md:p-9 flex flex-col justify-start relative overflow-y-auto">
          {/* Close Button Top Right */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* User Profile Header */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#7B8294] flex items-center justify-center overflow-hidden flex-shrink-0 text-white shadow-sm">
              <svg className="w-9 h-9 text-white mt-1.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                {displayName}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 tracking-normal">
                {studentId}
              </p>
            </div>
          </div>

          {/* Tab 1: Overview (Request Log) */}
          {activeTab === 'overview' && (
            <div className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">Request Log</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {requestsList.length} {requestsList.length === 1 ? 'request' : 'requests'}
                </span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-5 sm:p-6 overflow-hidden">
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white shadow-2xs z-10">
                      <tr className="text-slate-800 font-semibold text-[14px] border-b border-slate-200/80">
                        <th className="pb-3.5 font-bold pr-5 whitespace-nowrap">Request #</th>
                        <th className="pb-3.5 font-bold pr-5 whitespace-nowrap">Document Type</th>
                        <th className="pb-3.5 font-bold pr-5 whitespace-nowrap">Date</th>
                        <th className="pb-3.5 font-bold pr-5 whitespace-nowrap">Time</th>
                        <th className="pb-3.5 font-bold pr-5 whitespace-nowrap">Status</th>
                        <th className="pb-3.5 font-bold text-right whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                      {loadingRequests ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            Loading your requests...
                          </td>
                        </tr>
                      ) : requestsList.length > 0 ? (
                        requestsList.map((req, idx) => {
                          const dateObj = req.created_at ? new Date(req.created_at) : new Date();
                          const dateStr = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                          const timeStr = dateObj.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          }).toLowerCase();

                          const reqNum =
                            req.tracking_number ||
                            req.trackingId ||
                            req.request_number ||
                            `RQ-${String(req.id || idx + 97323).padStart(6, '0')}`;

                          const docType =
                            req.credential_name ||
                            req.document_type ||
                            req.document_type_name ||
                            'Transcript of Records';

                          const reqStatus = req.status || req.rawStatus || 'Pending';

                          return (
                            <tr key={req.id || idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 pr-5 text-slate-800 font-bold whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    navigate(`${ROUTES.STUDENT.REQUESTS}?track=${encodeURIComponent(reqNum)}`);
                                  }}
                                  className="text-[#0B0B7A] hover:text-amber-600 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                  title="Track this request"
                                >
                                  <span>{reqNum}</span>
                                  <span className="text-xs">↗</span>
                                </button>
                              </td>
                              <td className="py-3.5 pr-5 text-slate-700 font-medium">{docType}</td>
                              <td className="py-3.5 pr-5 text-slate-600 whitespace-nowrap">{dateStr}</td>
                              <td className="py-3.5 pr-5 text-slate-500 whitespace-nowrap text-xs">{timeStr}</td>
                              <td className="py-3.5 pr-5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(reqStatus)}`}>
                                  {formatStatus(reqStatus)}
                                </span>
                              </td>
                              <td className="py-3.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    navigate(`${ROUTES.STUDENT.REQUESTS}?track=${encodeURIComponent(reqNum)}`);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-[#0B0B7A] text-[#0B0B7A] hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Track
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                              </div>
                              <p className="text-sm font-semibold text-slate-700">No requests found</p>
                              <p className="text-xs text-slate-400 mt-0.5">You haven't submitted any credential requests yet.</p>
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

          {/* Tab 2: My Information */}
          {activeTab === 'information' && (
            <div className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">My Information</h3>
              </div>

              <form
                onSubmit={handleSaveInformation}
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
                        readOnly
                        value={displayName}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-500 outline-none select-text cursor-not-allowed font-medium"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editableEmail}
                        onChange={(e) => setEditableEmail(e.target.value)}
                        required
                        placeholder="Enter email address"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Academic Program */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Academic Program
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={academicProgram}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-500 outline-none select-text cursor-not-allowed truncate font-medium"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Student ID */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Student ID
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={studentId}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-500 outline-none select-text cursor-not-allowed font-medium"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        value={editableMobile}
                        onChange={(e) => setEditableMobile(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Year Level */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Year Level
                      </label>
                      <select
                        value={editableYearLevel}
                        onChange={(e) => setEditableYearLevel(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm cursor-pointer"
                      >
                        <option value="1st year">1st year</option>
                        <option value="2nd year">2nd year</option>
                        <option value="3rd year">3rd year</option>
                        <option value="4th year">4th year</option>
                        <option value="5th year">5th year</option>
                      </select>
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
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#000080] hover:bg-[#000066] text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Change Password */}
          {activeTab === 'password' && (
            <div className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">Change Password</h3>
                <span className="text-xs text-slate-500 font-medium">
                  Optional Security Setting
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6 md:p-8">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 mb-6 leading-relaxed">
                  <span className="font-semibold text-slate-800 block mb-0.5">Account Notice:</span>
                  Your default institutional password is your <strong>Student ID</strong> (<code>{studentId}</code>). Changing your password is fully optional. If you keep your default password, you can always log in with your Student ID.
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 mb-5 animate-fadeIn">
                    {passwordError}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPasswordError('');

                    if (!currentPassword.trim()) {
                      setPasswordError('Please enter your current password (default is your Student ID).');
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
                      const userKey = user?.username || studentId || user?.id || '';
                      const record = {
                        originalPassword: currentPassword.trim(),
                        newPassword: newPassword.trim(),
                        updatedAt: new Date().toISOString(),
                      };

                      if (userKey) customPasswords[userKey] = record;
                      if (user?.email) customPasswords[user.email.toLowerCase()] = record;
                      if (studentId) customPasswords[studentId] = record;

                      localStorage.setItem('regquest_custom_passwords', JSON.stringify(customPasswords));

                      setPasswordSuccess(true);
                      toast.success('Password updated successfully!');
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
                  }}
                  className="space-y-4 max-w-lg"
                >
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Current Password (or Student ID)
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
