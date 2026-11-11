import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import ustpBuilding from '../../assets/USTP.png';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);


  const handleRequestClick = (docName) => {
    navigate(`${ROUTES.STUDENT.NEW_REQUEST}?doc=${encodeURIComponent(docName)}`);
  };

  const FEATURED_CREDENTIALS = [
    {
      id: 'tor',
      code: 'TOR',
      docName: 'Transcript of Records (P125/pg)',
      title: 'Transcript of Records',
      description: 'Complete academic record of all courses taken and grades earned.',
      fee: '₱ 125/pg',
      bannerBg: 'bg-[#BAE6FD]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'hd',
      code: 'HONORABLE_DISMISSAL',
      docName: 'Honorable Dismissal (P100)',
      title: 'Honorable Dismissal',
      description: 'Transfer clearance document for moving to another institution.',
      fee: '₱ 100.00',
      bannerBg: 'bg-[#FED7AA]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'auth',
      code: 'AUTHENTICATION',
      docName: 'Authentication (P5/pg)',
      title: 'Authentication',
      description: 'Official verification and authentication of academic documents.',
      fee: '₱ 5/pg',
      bannerBg: 'bg-[#94A3B8]/60',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      id: 'eval',
      code: 'EVALUATION',
      docName: 'Evaluation (P50)',
      title: 'Evaluation',
      description: 'Detailed academic assessment and progress evaluation report.',
      fee: '₱ 75.00',
      bannerBg: 'bg-[#FBBF24]/80',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'cert',
      code: 'CERTIFICATION',
      docName: 'Certification (P80)',
      title: 'Certification',
      description: 'Official certificates for various academic achievements.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#FECDD3]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.21 13.89L7 22l5-3 5 3-1.21-8.11" />
        </svg>
      ),
    },
    {
      id: 'car',
      code: 'CAR',
      docName: 'Certification - CAR',
      title: 'CAR',
      description: 'Cumulative Academic Record summarizing your entire academic history.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#DDD6FE]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const EXPANDED_CREDENTIALS = [
    {
      id: 'gpa',
      code: 'GPA',
      docName: 'Certification - GPA',
      title: 'GPA',
      description: 'Official certification of your overall Grade Point Average and academic standing.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#A7F3D0]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      id: 'endorsement',
      code: 'ENDORSEMENT',
      docName: 'Certification - Endorsement',
      title: 'Endorsement',
      description: 'Official university letter of endorsement for employment, OJT, or scholarships.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#FBCFE8]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
    },
    {
      id: 'officially_enrolled',
      code: 'COE',
      docName: 'Certification - Officially enrolled',
      title: 'Officially Enrolled',
      description: 'Certificate certifying active enrollment and academic load for the current semester.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#BAE6FD]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      id: 'earned_units',
      code: 'EARNED_UNITS',
      docName: 'Certification - Earned Units',
      title: 'Earned Units',
      description: 'Official certification of cumulative academic units successfully completed.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#FDE68A]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-5.25 6.557c0 1.258.91 2.308 2.152 2.455.93.11 1.874.19 2.825.241m0 0a55.808 55.808 0 005.273-.241c1.242-.147 2.152-1.197 2.152-2.455v-3.675" />
        </svg>
      ),
    },
    {
      id: 'subjects_grades',
      code: 'SUBJECTS_GRADES',
      docName: 'Certification - Subjects w/ grades',
      title: 'Subjects w/ Grades',
      description: 'Breakdown and certification of specific subjects completed with earned final grades.',
      fee: '₱ 50.00',
      bannerBg: 'bg-[#DDD6FE]',
      icon: (
        <svg className="w-9 h-9 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ];

  const visibleCredentials = isExpanded
    ? [...FEATURED_CREDENTIALS, ...EXPANDED_CREDENTIALS]
    : FEATURED_CREDENTIALS;

  return (
    <div className="w-full flex flex-col min-h-screen bg-white">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#0B0B36] text-white min-h-[220px] sm:min-h-[260px] flex items-center">
        {/* USTP Building on the right with dark blue atmospheric gradient blend */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-3/5 lg:w-1/2 pointer-events-none overflow-hidden select-none">
          <img
            src={ustpBuilding}
            alt="USTP Campus Building"
            className="w-full h-full object-cover object-center opacity-45 mix-blend-screen filter contrast-125 brightness-95 scale-105"
          />
          {/* Gradients blending building seamlessly into the dark navy blue background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B36] via-[#0B0B36]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B36] via-transparent to-[#0B0B36]/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 py-8 sm:py-11 w-full">
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
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <h2 className="text-xl sm:text-2xl font-black text-[#0B0B36] tracking-tight mb-8 sm:mb-10">
            Available Credentials
          </h2>

          {/* Credentials Grid (expands smoothly when See More is clicked) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 transition-all duration-300">
            {visibleCredentials.map((card) => (
              <div
                key={card.id}
                onClick={() => handleRequestClick(card.docName)}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-amber-400/90 transition-all duration-200 overflow-hidden flex flex-col justify-between group cursor-pointer hover:-translate-y-1"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRequestClick(card.docName);
                  }
                }}
              >
                {/* Card Top Pastel Banner with Centered Translucent Icon Box */}
                <div className={`${card.bannerBg} h-32 sm:h-36 flex items-center justify-center transition-colors`}>
                  <div className="w-24 h-18 rounded-xl bg-white/50 backdrop-blur-xs flex items-center justify-center shadow-xs border border-white/50 transition-transform group-hover:scale-105 duration-200">
                    {card.icon}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1 group-hover:text-[#1F1F9B] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {card.description}
                    </p>
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

          {/* See More / See Less Credentials Button */}
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
