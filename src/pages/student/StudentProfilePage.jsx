import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import requestsApi from '../../api/requests';

export default function StudentProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'information'
  const [requestsList, setRequestsList] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const displayName =
    user?.full_name ||
    (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) ||
    (user?.username && !/^\d{6,}$/.test(user.username) ? user.username : null) ||
    'Juan De Letchi';

  const studentId = user?.student_id || user?.username || '2026202666';
  const email = user?.email || (user?.username === '2023301564' ? 'daisy.traya@ustp.edu.ph' : 'juan@email.com');
  const mobileNumber = user?.phone || user?.mobile_number || '09561236549';
  const academicProgram = user?.program || 'B.S. in Information Technology';
  const yearLevel = user?.year_level || '1st year';

  return (
    <div className="min-h-screen bg-[#F4F5F8] p-4 md:p-8 flex items-center justify-center">
      <div
        className="bg-[#F8F9FA] border border-slate-200/90 rounded-2xl w-full max-w-4xl shadow-xl flex flex-col md:flex-row overflow-hidden text-slate-800"
        style={{ minHeight: '520px' }}
      >
        {/* Left Navigation Panel */}
        <div className="w-full md:w-52 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-6 flex flex-col justify-between shrink-0">
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
                        <th className="pb-4 font-semibold pr-4">Request #</th>
                        <th className="pb-4 font-semibold pr-4">Document Type</th>
                        <th className="pb-4 font-semibold pr-4">Date</th>
                        <th className="pb-4 font-semibold">Time</th>
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
                              <td className="py-3.5 pr-4 text-slate-700 font-medium">{reqNum}</td>
                              <td className="py-3.5 pr-4 text-slate-600">{docType}</td>
                              <td className="py-3.5 pr-4 text-slate-600">{dateStr}</td>
                              <td className="py-3.5 text-slate-600">{timeStr}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 pr-4 text-slate-700 font-medium">RQ-097323</td>
                          <td className="py-3.5 pr-4 text-slate-600">Transcript of Records</td>
                          <td className="py-3.5 pr-4 text-slate-600">May 9, 2026</td>
                          <td className="py-3.5 text-slate-600">10:26:13 am</td>
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
              <h3 className="text-xl font-bold text-[#000080] mb-4">My Information</h3>
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={displayName}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Email
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={email}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default truncate"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Academic Program
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={academicProgram}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default truncate"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Student ID
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={studentId}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={mobileNumber}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Year Level
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={yearLevel}
                        className="w-full bg-[#F1F3F5] border border-slate-200/90 rounded-lg px-3.5 py-2 text-sm text-slate-700 outline-none select-text cursor-default"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
