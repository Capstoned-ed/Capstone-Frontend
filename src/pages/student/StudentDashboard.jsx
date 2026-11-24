import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import credentialTypesApi, { REQUEST_FORM_CREDENTIAL_TYPES } from '../../api/credentialTypes';
import ustpBuilding from '../../assets/USTP.png';

// Uniform Document Icon (Transcript of Records style document with lines)
const UniformDocumentIcon = () => (
  <svg
    className="w-6 h-6 text-[#1D4ED8]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [credentialTypes, setCredentialTypes] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCredentialTypes() {
      try {
        const types = await credentialTypesApi.list();
        if (isMounted && Array.isArray(types) && types.length > 0) {
          setCredentialTypes(types);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic credential types for student dashboard:', err);
      }
    }
    loadCredentialTypes();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestClick = (docName) => {
    navigate(`${ROUTES.STUDENT.NEW_REQUEST}?doc=${encodeURIComponent(docName)}`);
  };

  const activeTypes = useMemo(() => {
    const source = credentialTypes.length > 0 ? credentialTypes : REQUEST_FORM_CREDENTIAL_TYPES;
    return source.filter((c) => c && c.is_active !== false);
  }, [credentialTypes]);

  const credentialCards = useMemo(() => {
    return activeTypes.map((c) => {
      const codeUpper = String(c.code || '').toUpperCase();
      const rawName = String(c.name || '').trim();

      // Clean title for display
      let displayTitle = rawName;
      if (codeUpper === 'TOR' || rawName.toLowerCase().includes('transcript')) {
        displayTitle = 'Transcript of Records';
      } else if (rawName.startsWith('Certification - ')) {
        displayTitle = rawName.replace(/^Certification - /i, '');
      } else if (rawName.endsWith(' (TOR)')) {
        displayTitle = rawName.replace(/ \(TOR\)/i, '');
      }

      // Format fee
      let fee = '₱ 50.00';
      if (codeUpper === 'TOR' || rawName.toLowerCase().includes('transcript')) {
        fee = '₱ 125/pg';
      } else if (codeUpper === 'AUTH' || rawName.toLowerCase().includes('authentication')) {
        fee = '₱ 5/pg';
      } else if (c.price !== undefined && c.price !== null) {
        const p = parseFloat(c.price);
        fee = isNaN(p) ? '₱ 50.00' : `₱ ${p.toFixed(2)}`;
      }

      const description =
        c.description ||
        (codeUpper === 'TOR'
          ? 'Complete academic record of all courses taken and grades earned.'
          : codeUpper === 'HD'
          ? 'Transfer clearance document for moving to another institution.'
          : codeUpper === 'AUTH'
          ? 'Official verification and authentication of academic documents.'
          : codeUpper === 'EVAL'
          ? 'Detailed academic assessment and progress evaluation report.'
          : codeUpper === 'GPA'
          ? 'Official certification of your overall Grade Point Average and academic standing.'
          : codeUpper === 'CAR'
          ? 'Cumulative Academic Record summarizing your entire academic history.'
          : 'Official academic credential requested from the University Registrar.');

      return {
        id: String(c.id || c.code || rawName),
        code: c.code || '',
        docName: rawName,
        title: displayTitle,
        description,
        fee,
      };
    });
  }, [activeTypes]);

  const visibleCredentials = isExpanded
    ? credentialCards
    : credentialCards.slice(0, 6);

  return (
    <div className="w-full flex flex-col min-h-screen bg-white">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#0B0B36] text-white min-h-[220px] sm:min-h-[260px] flex items-center">
        {/* USTP Building full-width matching Admin/Staff/Registrar banner color */}
        <div className="absolute inset-0 w-full pointer-events-none overflow-hidden select-none">
          <img
            src={ustpBuilding}
            alt="USTP Campus Building"
            className="w-full h-full object-cover opacity-[0.38] sm:opacity-[0.44] mix-blend-screen scale-105"
            style={{
              objectPosition: 'center right',
              filter: 'brightness(1.04) contrast(1.06)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(11, 11, 54, 0.95) 0%, rgba(11, 11, 54, 0.86) 45%, rgba(11, 11, 54, 0.48) 75%, rgba(11, 11, 54, 0.15) 100%)',
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 pt-4 pb-12 sm:pt-3 sm:pb-16 w-full">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Your Credentials,<br />
              <span className="text-amber-400">Fast &amp; Secure</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2.5 sm:mt-3 leading-relaxed max-w-lg font-normal">
              Request your Transcript of Records, Diploma, and other documents online. Skip the lines and track your request in real-time.
            </p>

            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm rounded-full transition-all shadow-md cursor-pointer"
              >
                Start Request
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.STUDENT.REQUESTS)}
                className="px-6 py-2.5 bg-transparent hover:bg-white/10 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-full transition-all border border-amber-400/80 hover:border-amber-400 cursor-pointer"
              >
                Track Status
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Available Credentials Section */}
      <section className="bg-white py-12 sm:py-16 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#F8FAFF] rounded-2xl sm:rounded-3xl border border-blue-200/80 shadow-lg p-6 sm:p-8 lg:p-10">
            <h2 className="text-xl sm:text-2xl font-black text-[#0B0B36] tracking-tight mb-6 sm:mb-8">
              Available Credentials
            </h2>

            {/* Credentials Grid (expands smoothly when See More is clicked) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 transition-all duration-300">
            {visibleCredentials.map((card) => (
              <div
                key={card.id}
                onClick={() => handleRequestClick(card.docName)}
                className="bg-white rounded-2xl border border-blue-200/90 shadow-sm hover:shadow-lg hover:border-blue-500 transition-all duration-200 p-5 flex flex-col justify-between group cursor-pointer hover:-translate-y-0.5"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRequestClick(card.docName);
                  }
                }}
              >
                {/* Card Body */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] border border-blue-200/70 flex items-center justify-center shrink-0 [&>svg]:w-6 [&>svg]:h-6 [&>svg]:text-[#1D4ED8] group-hover:from-[#1D4ED8] group-hover:to-[#0B0B36] group-hover:border-transparent group-hover:[&>svg]:text-white transition-all duration-200">
                      <UniformDocumentIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#1D4ED8] transition-colors leading-snug">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-1">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Row: Fee & Request Button */}
                  <div className="pt-4 mt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Fee:
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#0B0B36]">
                        {card.fee}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestClick(card.docName);
                      }}
                      className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-extrabold text-[11px] rounded-full flex items-center gap-1 transition-all shadow-xs cursor-pointer group-hover:shadow-md"
                    >
                      <span>Request</span>
                      <span className="text-xs">→</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* See More / See Less Credentials Button (only if more than 6 credentials) */}
          {credentialCards.length > 6 && (
            <div className="mt-12 sm:mt-14 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-8 py-2.5 rounded-full border-2 border-[#1F1F9B] text-[#1F1F9B] hover:bg-[#1F1F9B] hover:text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
              >
                <span>{isExpanded ? 'See Less Credentials' : 'See More Credentials'}</span>
                <span className={`text-sm transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                  {isExpanded ? '↑' : '→'}
                </span>
              </button>
            </div>
          )}
          </div>
        </div>
      </section>


      {/* 3. Streamlining the Credential Process Section */}
      <section className="bg-slate-50/70 py-10 sm:py-12 px-4 sm:px-8 border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto">
          {/* Main Showcase Card Container */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 lg:p-10 border border-slate-200/80 shadow-lg overflow-hidden">
            {/* Ambient background decoration */}
            <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            {/* Header Content */}
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#0B0B36] tracking-tight">
                Streamlining the Credential Process
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Our mission is to reduce physical queues, modernize authentication, and provide rapid turnaround for all registrar services.
              </p>
            </div>

            {/* 3 Value Proposition Cards */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 mt-7 sm:mt-8">
              {/* Card 1: Secure & Confidential */}
              <div className="group rounded-xl sm:rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-white border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col text-left">
                <div className="w-10 h-10 rounded-lg bg-[#0B0B36] text-white flex items-center justify-center shadow-sm mb-3.5 group-hover:scale-105 transition-transform duration-200">
                  <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit mb-2">
                  Verified Data
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B0B36] mb-1.5">
                  Secure &amp; Confidential
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your academic records are encrypted and protected. Access is strictly audited to ensure your data stays authentic and private.
                </p>
              </div>

              {/* Card 2: Fast Turnaround */}
              <div className="group rounded-xl sm:rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-white border border-slate-200/90 hover:border-amber-300 shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col text-left">
                <div className="w-10 h-10 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shadow-sm mb-3.5 group-hover:scale-105 transition-transform duration-200">
                  <svg className="w-5 h-5 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 w-fit mb-2">
                  50% Faster Processing
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B0B36] mb-1.5">
                  Fast Turnaround
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  By digitizing the review and clearance flow, requests are queued directly to staff desks, delivering credentials without delays.
                </p>
              </div>

              {/* Card 3: Queue-Free Experience */}
              <div className="group rounded-xl sm:rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-white border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col text-left">
                <div className="w-10 h-10 rounded-lg bg-indigo-900 text-white flex items-center justify-center shadow-sm mb-3.5 group-hover:scale-105 transition-transform duration-200">
                  <svg className="w-5 h-5 text-sky-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 w-fit mb-2">
                  100% Digital Flow
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B0B36] mb-1.5">
                  Queue-Free Experience
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No more standing in long campus lines. Submit requests, verify clearances, upload receipts, and track updates anywhere.
                </p>
              </div>
            </div>

            </div>
        </div>
      </section>
    </div>
  );
}
