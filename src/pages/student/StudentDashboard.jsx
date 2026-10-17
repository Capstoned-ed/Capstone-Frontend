import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import credentialTypesApi from '../../api/credentialTypes';
import clearancesApi from '../../api/clearances';
import CredentialTypeCard from '../../components/credentials/CredentialTypeCard';
import '../../styles/CredentialTypes.css';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState([]);
  const [clearance, setClearance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const [credsData, clearanceList] = await Promise.all([
          credentialTypesApi.list().catch(() => []),
          clearancesApi.list().catch(() => []),
        ]);

        if (!ignore) {
          setCredentials(credsData.filter((t) => t.is_active));
          if (Array.isArray(clearanceList) && clearanceList.length > 0) {
            setClearance(clearanceList[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load credentials for dashboard:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-7 pb-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0B0B36] to-[#1F1F9C] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-300 mb-3">
            Student Portal
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name || user?.first_name || user?.username || 'Student'}!
          </h2>
          <p className="text-sm text-slate-200 mt-2 max-w-xl leading-relaxed">
            Manage your document requests, clearance submissions, and track processing statuses in real-time.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Request New Document</span>
            </button>
            <button
              onClick={() => navigate(ROUTES.STUDENT.CREDENTIALS)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all border border-white/15 cursor-pointer"
            >
              Explore Credentials Catalog
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
            📄
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Requests</p>
            <p className="text-2xl font-extrabold text-slate-800">1</p>
          </div>
        </div>

        {/* Dynamic Clearance Stat Card */}
        <div
          onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
          className={`rounded-xl p-5 border shadow-xs flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-98 ${
            clearance?.status === 'APPROVED'
              ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
              : clearance?.status === 'REJECTED'
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
          title="Attach clearance during document request"
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
              clearance?.status === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-700'
                : clearance?.status === 'REJECTED'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            {clearance?.status === 'APPROVED' ? '✅' : clearance?.status === 'REJECTED' ? '❌' : '⏳'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clearance Status</p>
            <p
              className={`text-sm sm:text-base font-extrabold truncate mt-0.5 ${
                clearance?.status === 'APPROVED'
                  ? 'text-emerald-700'
                  : clearance?.status === 'REJECTED'
                  ? 'text-rose-700'
                  : 'text-amber-800'
              }`}
            >
              {clearance?.status === 'APPROVED'
                ? 'Approved & Cleared'
                : clearance?.status === 'REJECTED'
                ? 'Rejected (Action Req.)'
                : clearance?.status === 'PENDING'
                ? 'Pending Review'
                : 'Not Yet Submitted'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
            🎓
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-extrabold text-slate-800">0</p>
          </div>
        </div>
      </div>

      {/* Available Document Credentials Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Available Credentials &amp; Documents
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an official university credential to begin your request.
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.STUDENT.CREDENTIALS)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({credentials.length})</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="student-credentials-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-slate-200 rounded w-16" />
                  <div className="h-6 bg-slate-200 rounded w-20" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-4/5" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-10 bg-slate-200 rounded-lg w-full mt-4" />
              </div>
            ))}
          </div>
        ) : credentials.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-xs text-slate-400">
            No credential types currently available.
          </div>
        ) : (
          <div className="student-credentials-grid">
            {credentials.slice(0, 3).map((type) => (
              <CredentialTypeCard key={type.id} credentialType={type} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
