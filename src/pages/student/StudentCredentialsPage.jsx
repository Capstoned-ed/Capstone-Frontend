import React, { useState, useEffect } from 'react';
import credentialTypesApi from '../../api/credentialTypes';
import CredentialTypeCard from '../../components/credentials/CredentialTypeCard';
import '../../styles/CredentialTypes.css';

export default function StudentCredentialsPage() {
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const data = await credentialTypesApi.list();
        if (!ignore) {
          // Students only see active credential types
          setCredentialTypes(data.filter((t) => t.is_active));
        }
      } catch (err) {
        console.error('Failed to load available credentials:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredTypes = credentialTypes.filter((type) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      type.code?.toLowerCase().includes(q) ||
      type.name?.toLowerCase().includes(q) ||
      type.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="credentials-page-wrapper">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B0B36] to-[#1F1F9C] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-300 mb-3">
            Academic Document Catalog
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Available Institutional Credentials
          </h2>
          <p className="text-sm text-slate-200 mt-2 leading-relaxed">
            Browse official university documents, certifications, transcripts, and diplomas offered by the Registrar's Office. Review fees and estimated processing times before initiating your request.
          </p>

          {/* Search bar inside banner */}
          <div className="mt-5 max-w-md relative">
            <input
              type="text"
              placeholder="Search available credentials by title or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white/95 text-slate-800 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium shadow-sm transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Grid of Available Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Offered Documents ({filteredTypes.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Updated in real-time by Registrar Admin
          </span>
        </div>

        {loading ? (
          <div className="student-credentials-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-slate-200 rounded w-16" />
                  <div className="h-6 bg-slate-200 rounded w-20" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-4/5" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
                <div className="h-10 bg-slate-200 rounded-lg w-full mt-4" />
              </div>
            ))}
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
              🔍
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              No matching credentials found
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search terms to find other university documents.
            </p>
          </div>
        ) : (
          <div className="student-credentials-grid">
            {filteredTypes.map((type) => (
              <CredentialTypeCard key={type.id} credentialType={type} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
