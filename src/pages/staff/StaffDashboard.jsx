import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import ustpBuilding from '../../assets/USTP.png';
import requestsApi from '../../api/requests';
import { StaffProcessModal } from '../../components/staff';
import useToast from '../../hooks/useToast';

const INITIAL_REQUESTS = [
  {
    id: 1,
    tracking_number: 'REQ-000001',
    student_name: 'Jessica Gabica',
    student_id: '2023303247',
    document_type: 'Transcript of records',
    copies: 2,
    status: 'Pending',
    request_date: '2026-03-05',
    release_date: '2026-08-05',
  },
  {
    id: 2,
    tracking_number: 'REQ-000002',
    student_name: 'Faith Love Traya',
    student_id: '2023301853',
    document_type: 'Honorable Dismissal',
    copies: 1,
    status: 'Ready for Pickup',
    request_date: '2026-03-05',
    release_date: '2026-08-05',
  },
  {
    id: 3,
    tracking_number: 'REQ-000003',
    student_name: 'Luredel Dulangon',
    student_id: '2023303057',
    document_type: 'Evaluation',
    copies: 1,
    status: 'Processing',
    request_date: '2026-03-05',
    release_date: '2026-08-05',
  },
  {
    id: 4,
    tracking_number: 'REQ-000004',
    student_name: 'Ken Neri',
    student_id: '2023301234',
    document_type: 'Transcript of records',
    copies: 1,
    status: 'Claimed',
    request_date: '2026-03-05',
    release_date: '2026-08-05',
  },
  {
    id: 5,
    tracking_number: 'REQ-000005',
    student_name: 'Ralph Perocho',
    student_id: '2023304321',
    document_type: 'Officially enrolled',
    copies: 1,
    status: 'Pending',
    request_date: '2026-03-05',
    release_date: '2026-08-05',
  },
];

export default function StaffDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [requestsList, setRequestsList] = useState(INITIAL_REQUESTS);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // Load backend requests and blend with initial sample requests if fewer
  useEffect(() => {
    requestsApi
      .list()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Format backend requests to match table format
          const formatted = data.map((r, idx) => ({
            id: r.id || idx + 1,
            tracking_number: r.tracking_number || `REQ-${String(r.id || idx + 1).padStart(6, '0')}`,
            student_name: r.student_name || r.full_name || `Student #${r.user || idx + 1}`,
            student_id: r.student_id || r.username || '2023301564',
            document_type: r.credential_name || r.document_type || 'Transcript of records',
            copies: r.copies || 1,
            status: r.status ? (r.status === 'READY_FOR_RELEASE' ? 'Ready for Pickup' : r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase()) : 'Pending',
            request_date: r.created_at ? r.created_at.split('T')[0] : '2026-03-05',
            release_date: r.release_date || '2026-08-05',
            raw: r,
          }));

          // Fill up to 5 with INITIAL_REQUESTS if needed
          const combined = [...formatted];
          INITIAL_REQUESTS.forEach((sample) => {
            if (!combined.some((item) => item.tracking_number === sample.tracking_number)) {
              if (combined.length < 5) {
                combined.push(sample);
              }
            }
          });
          setRequestsList(combined.slice(0, 5));
        }
      })
      .catch((err) => {
        console.warn('Backend requests load info:', err);
      });
  }, []);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('pending')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF9C3] text-[#854D0E] shadow-2xs">
          Pending
        </span>
      );
    }
    if (s.includes('pickup') || s.includes('release') || s.includes('ready')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] shadow-2xs">
          Ready for Pickup
        </span>
      );
    }
    if (s.includes('processing')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] shadow-2xs">
          Processing
        </span>
      );
    }
    if (s.includes('claimed')) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#BBF7D0] text-[#15803D] shadow-2xs">
          Claimed
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  return (
    <div className="bg-[#F4F5F8] min-h-screen">
      {/* 1. Full-Width Hero Banner */}
      <section className="relative bg-[#0B0B36] text-white overflow-hidden py-10 px-6 sm:px-10 lg:px-12 select-none">
        {/* USTP Building Background Texture with Smooth Gradients */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 sm:w-1/2 opacity-30 pointer-events-none overflow-hidden">
          <img
            src={ustpBuilding}
            alt="USTP Campus Building"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B36] via-[#0B0B36]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B36] via-transparent to-[#0B0B36]/60" />
        </div>

        {/* Hero Title & Subtitle */}
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Registrar Staff
          </h1>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#F5B014] mt-1 tracking-tight">
            Dashboard
          </p>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-normal leading-relaxed">
            Manage and process student document requests
          </p>
        </div>
      </section>

      {/* 2. Main Dashboard Content Grid */}
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-7">
        {/* Section 1: Targeted for Completion Today */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Monday, May 7, 2026</p>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">5 Documents</h2>
              <p className="text-xs text-slate-400 font-normal">Targeted for completion today</p>
            </div>
          </div>

          {/* 4 Document Type Subcards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* Subcard 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">Transcript of records</span>
                <span className="bg-[#E60000] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  High
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">3</p>
              <p className="text-xs text-slate-400 font-normal">copies</p>
            </div>

            {/* Subcard 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">Honorable Dismissal</span>
                <span className="bg-[#FF6B00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  Medium
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">1</p>
              <p className="text-xs text-slate-400 font-normal">copies</p>
            </div>

            {/* Subcard 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">Evaluation</span>
                <span className="bg-[#FF6B00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  Medium
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">1</p>
              <p className="text-xs text-slate-400 font-normal">copies</p>
            </div>

            {/* Subcard 4 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 truncate">Officially Enrolled</span>
                <span className="bg-[#FF6B00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  Medium
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">1</p>
              <p className="text-xs text-slate-400 font-normal">copies</p>
            </div>
          </div>
        </div>

        {/* Section 2: 4 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Requests */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Total Requests</span>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">5</p>
            <p className="text-xs text-slate-400 mt-1">All Time</p>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-orange-400 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Pending</span>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">3</p>
            <p className="text-xs text-slate-400 mt-1">Need Attention</p>
          </div>

          {/* Processing */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-500 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Processing</span>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">1</p>
            <p className="text-xs text-slate-400 mt-1">In progress</p>
          </div>

          {/* Completed Today */}
          <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Completed Today</span>
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">1</p>
            <p className="text-xs text-slate-400 mt-1">Released</p>
          </div>
        </div>

        {/* Section 3: Predicted Insight this week */}
        <div className="bg-[#DDE3FF] rounded-2xl p-6 border border-[#C5D0FF] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#BAC7FF] flex items-center justify-center text-[#2A3CB8] shrink-0 shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04zm5 0A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0A0A7C]">Predicted Insight this week</h3>
          </div>

          <div className="bg-[#7084D8]/85 rounded-xl p-5 text-white shadow-xs mt-3.5 space-y-2 text-xs sm:text-sm font-normal">
            <p className="flex items-start gap-2">
              <span className="text-white text-base leading-none">•</span>
              <span>
                Request volume is expected to peak <strong className="font-bold text-white">this week</strong> with approximately <strong className="font-bold text-white">25 requests</strong>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-white text-base leading-none">•</span>
              <span>
                Transcript of records requests show <strong className="font-bold text-white">+8% growth trend</strong>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-white text-base leading-none">•</span>
              <span>
                Model accuracy based on last 4 weeks: <strong className="font-bold text-white">87% confidence</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Section 4: Calendar (Weekly Schedule) */}
        <div id="calendar" className="bg-[#EAF0FE] rounded-2xl p-6 border border-[#D5E0FA] shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Monday, May 7, 2026</p>
              <h3 className="text-xl font-bold text-slate-900">Calendar</h3>
            </div>
          </div>

          {/* 7-Day Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs mt-5">
            {/* Calendar Table Header */}
            <div className="grid grid-cols-7 bg-[#C7D7FE] border-b border-slate-200 text-center">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                <div key={day} className="py-2.5 font-bold text-xs text-[#0A0A7C] border-r last:border-r-0 border-slate-300/60 truncate px-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[175px]">
              {/* Sunday */}
              <div className="p-3 font-bold text-slate-800 text-lg">
                3
              </div>

              {/* Monday */}
              <div className="p-2 sm:p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-lg">4</span>
                    <span className="bg-[#00D02A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      100%
                    </span>
                  </div>
                  <div className="space-y-1 text-[9px] sm:text-[10px]">
                    <div className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate" title="Release document from: April 20, 2026">
                      Release document from: April 20, 2026
                    </div>
                    <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                      <span>Process document:</span>
                      <strong className="font-bold">5</strong>
                    </div>
                    <div className="bg-[#FEF9C3] text-[#854D0E] p-1 rounded font-medium flex justify-between">
                      <span>New requests:</span>
                      <strong className="font-bold">20</strong>
                    </div>
                  </div>
                </div>
                <div className="w-full h-1 bg-[#00D02A] rounded-full mt-2" />
              </div>

              {/* Tuesday */}
              <div className="p-2 sm:p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-lg">5</span>
                    <span className="bg-[#00D02A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      100%
                    </span>
                  </div>
                  <div className="space-y-1 text-[9px] sm:text-[10px]">
                    <div className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate" title="Release document from: April 21, 2026">
                      Release document from: April 21, 2026
                    </div>
                    <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                      <span>Process document:</span>
                      <strong className="font-bold">8</strong>
                    </div>
                    <div className="bg-[#FEF9C3] text-[#854D0E] p-1 rounded font-medium flex justify-between">
                      <span>New requests:</span>
                      <strong className="font-bold">10</strong>
                    </div>
                  </div>
                </div>
                <div className="w-full h-1 bg-[#00D02A] rounded-full mt-2" />
              </div>

              {/* Wednesday */}
              <div className="p-2 sm:p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-lg">6</span>
                    <span className="bg-[#00D02A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      100%
                    </span>
                  </div>
                  <div className="space-y-1 text-[9px] sm:text-[10px]">
                    <div className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate" title="Release document from: April 22, 2026">
                      Release document from: April 22, 2026
                    </div>
                    <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                      <span>Process document:</span>
                      <strong className="font-bold">10</strong>
                    </div>
                    <div className="bg-[#FEF9C3] text-[#854D0E] p-1 rounded font-medium flex justify-between">
                      <span>New requests:</span>
                      <strong className="font-bold">5</strong>
                    </div>
                  </div>
                </div>
                <div className="w-full h-1 bg-[#00D02A] rounded-full mt-2" />
              </div>

              {/* Thursday */}
              <div className="p-2 sm:p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-lg">7</span>
                    <span className="bg-[#F59E0B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      95%
                    </span>
                  </div>
                  <div className="space-y-1 text-[9px] sm:text-[10px]">
                    <div className="bg-[#DCFCE7] text-[#15803D] p-1 rounded font-medium truncate" title="Release document from: May 1, 2026">
                      Release document from: May 1, 2026
                    </div>
                    <div className="bg-[#E0F2FE] text-[#0369A1] p-1 rounded font-medium flex justify-between">
                      <span>Process document:</span>
                      <strong className="font-bold">11</strong>
                    </div>
                    <div className="bg-[#FEF9C3] text-[#854D0E] p-1 rounded font-medium flex justify-between">
                      <span>New requests:</span>
                      <strong className="font-bold">3</strong>
                    </div>
                  </div>
                </div>
                <div className="w-full h-1 bg-[#F59E0B] rounded-full mt-2" />
              </div>

              {/* Friday */}
              <div className="p-3 font-bold text-slate-800 text-lg">
                8
              </div>

              {/* Saturday */}
              <div className="p-3 font-bold text-slate-800 text-lg">
                9
              </div>
            </div>

            {/* Optional Collapsible Second Week when expanded */}
            {isCalendarExpanded && (
              <div className="border-t border-slate-200 grid grid-cols-7 divide-x divide-slate-200 min-h-[120px] bg-slate-50/50 animate-fadeIn">
                <div className="p-3 font-bold text-slate-800 text-base">10</div>
                <div className="p-3 font-bold text-slate-800 text-base">11</div>
                <div className="p-3 font-bold text-slate-800 text-base">12</div>
                <div className="p-3 font-bold text-slate-800 text-base">13</div>
                <div className="p-3 font-bold text-slate-800 text-base">14</div>
                <div className="p-3 font-bold text-slate-800 text-base">15</div>
                <div className="p-3 font-bold text-slate-800 text-base">16</div>
              </div>
            )}
          </div>

          {/* Toggle View All button */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              className="text-[#0A0A7C] font-bold text-sm flex items-center gap-1 hover:underline cursor-pointer transition-all"
            >
              <span>{isCalendarExpanded ? 'Show Less' : 'View All'}</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isCalendarExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Section 5: Requests Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Requests</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest document requests from students</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.STAFF.REQUESTS)}
              className="px-5 py-2 rounded-lg bg-[#000080] hover:bg-[#000066] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              View All
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4">Release Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {requestsList.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Request ID */}
                    <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {req.tracking_number}
                    </td>

                    {/* Student */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-900 leading-tight">{req.student_name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{req.student_id}</p>
                    </td>

                    {/* Document Type */}
                    <td className="py-4 px-4">
                      <p className="text-slate-800 font-medium">{req.document_type}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{req.copies} {req.copies > 1 ? 'copies' : 'copy'}</p>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* Request Date */}
                    <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {req.request_date}
                    </td>

                    {/* Release Date */}
                    <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {req.release_date}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (req.raw) {
                            setSelectedRequest(req.raw);
                          } else {
                            navigate(`${ROUTES.STAFF.REQUESTS}?search=${encodeURIComponent(req.tracking_number)}`);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Staff Process Modal if a backend request is clicked */}
      {selectedRequest && (
        <StaffProcessModal
          selectedRequest={selectedRequest}
          newStatus={selectedRequest.status}
          setNewStatus={() => {}}
          notes=""
          setNotes={() => {}}
          updating={false}
          onUpdateStatus={() => {
            setSelectedRequest(null);
            toast.info('Status updated.');
          }}
          onBackToList={() => setSelectedRequest(null)}
          requestStatuses={['Pending', 'Processing', 'For release', 'Claimed', 'On Hold']}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}
