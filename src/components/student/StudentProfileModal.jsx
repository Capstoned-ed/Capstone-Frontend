import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import requestsApi from '../../api/requests';
import useToast from '../../hooks/useToast';

export default function StudentProfileModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'information'
  const [requestsList, setRequestsList] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Editable fields state (Email, Mobile Number, Year Level)
  const [editableEmail, setEditableEmail] = useState('');
  const [editableMobile, setEditableMobile] = useState('');
  const [editableYearLevel, setEditableYearLevel] = useState('1st year');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
        const userKey = user?.id || user?.username || user?.student_id;
        const p = profiles[userKey] || profiles[user?.username] || {};

        setEditableEmail(
          p.email ||
          user?.email ||
          (user?.username === '2023301564' ? 'daisy.traya@ustp.edu.ph' : 'juan@email.com')
        );
        setEditableMobile(
          p.mobile_number ||
          p.phone ||
          user?.phone ||
          user?.mobile_number ||
          '09561236549'
        );
        setEditableYearLevel(
          p.year_level ||
          user?.year_level ||
          '1st year'
        );
      } catch {
        setEditableEmail(user?.email || 'juan@email.com');
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

  // Load requests when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingRequests(true);
      requestsApi
        .list()
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setRequestsList(res);
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
  }, [isOpen]);

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
        <div className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-6 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            {/* Overview Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-colors text-left ${
                activeTab === 'overview'
                  ? 'text-[#0B0B7A] font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
              </svg>
              <span className="text-[15px]">Overview</span>
            </button>

            {/* My Information Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab('information')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-colors text-left ${
                activeTab === 'information'
                  ? 'text-[#0B0B7A] font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[15px]">My Information</span>
            </button>
          </div>

          {/* Bottom Log out Button */}
          <div className="pt-6">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50/50 transition-colors text-left font-medium"
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
        <div className="flex-1 p-7 md:p-9 flex flex-col justify-start relative overflow-y-auto">
          {/* Close Button Top Right */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute top-6 right-6 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
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
              <h3 className="text-xl font-bold text-[#000080] mb-4">Request Log</h3>
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-800 font-semibold text-[15px]">
                        <th className="pb-4 font-semibold pr-6 whitespace-nowrap">Request #</th>
                        <th className="pb-4 font-semibold pr-6 whitespace-nowrap">Document Type</th>
                        <th className="pb-4 font-semibold pr-6 whitespace-nowrap">Date</th>
                        <th className="pb-4 font-semibold whitespace-nowrap">Time</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                      {requestsList.length > 0 ? (
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
                            req.request_number ||
                            `RQ-${String(req.id || idx + 97323).padStart(6, '0')}`;

                          const docType =
                            req.credential_name ||
                            req.document_type ||
                            req.document_type_name ||
                            'Transcript of Records';

                          return (
                            <tr key={req.id || idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 pr-6 text-slate-700 font-medium whitespace-nowrap">{reqNum}</td>
                              <td className="py-3.5 pr-6 text-slate-600">{docType}</td>
                              <td className="py-3.5 pr-6 text-slate-600 whitespace-nowrap">{dateStr}</td>
                              <td className="py-3.5 text-slate-600 whitespace-nowrap">{timeStr}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 pr-6 text-slate-700 font-medium whitespace-nowrap">RQ-097323</td>
                          <td className="py-3.5 pr-6 text-slate-600">Transcript of Records</td>
                          <td className="py-3.5 pr-6 text-slate-600 whitespace-nowrap">May 9, 2026</td>
                          <td className="py-3.5 text-slate-600 whitespace-nowrap">10:26:13 am</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: My Information (Email, Mobile Number, Year Level Editable) */}
          {activeTab === 'information' && (
            <div className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#000080]">My Information</h3>
                <span className="text-xs text-slate-500 font-medium">
                  Editable: Email, Mobile Number, Year Level
                </span>
              </div>

              <form
                onSubmit={handleSaveInformation}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6 md:p-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Full Name (Read-only) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Full Name
                        </label>
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Read-only
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={displayName}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-500 outline-none select-text cursor-not-allowed font-medium"
                      />
                    </div>

                    {/* Email (Editable) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Email
                        </label>
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Editable
                        </span>
                      </div>
                      <input
                        type="email"
                        value={editableEmail}
                        onChange={(e) => setEditableEmail(e.target.value)}
                        required
                        placeholder="Enter email address"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Academic Program (Read-only) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Academic Program
                        </label>
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Read-only
                        </span>
                      </div>
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
                    {/* Student ID (Read-only) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Student ID
                        </label>
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Read-only
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={studentId}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2.5 text-sm text-slate-500 outline-none select-text cursor-not-allowed font-medium"
                      />
                    </div>

                    {/* Mobile Number (Editable) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Mobile Number
                        </label>
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Editable
                        </span>
                      </div>
                      <input
                        type="tel"
                        value={editableMobile}
                        onChange={(e) => setEditableMobile(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        className="w-full bg-white border border-slate-300 focus:border-[#000080] focus:ring-2 focus:ring-[#000080]/15 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* Year Level (Editable) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Year Level
                        </label>
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Editable
                        </span>
                      </div>
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
        </div>
      </div>
    </div>,
    document.body
  );
}
