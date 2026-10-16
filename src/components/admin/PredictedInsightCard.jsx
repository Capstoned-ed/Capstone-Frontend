import React from 'react';

export default function PredictedInsightCard() {
  return (
    <div className="bg-[#DCE6FF] rounded-2xl p-5 sm:p-6 border border-indigo-200/80 shadow-xs">
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-xl bg-[#CCD9FE] text-[#3730A3] flex items-center justify-center flex-shrink-0 shadow-inner">
          {/* Brain / AI Insight Icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L4.2 13.9M12 15v6m-4-3h8" />
          </svg>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-[#151740] tracking-tight">
          Predicted Insight this week
        </h2>
      </div>

      {/* Inner Insight Box */}
      <div className="bg-[#7888F6] rounded-xl p-4 sm:p-5 text-[#0A0D28]">
        <ul className="space-y-2 text-xs sm:text-sm leading-relaxed">
          <li className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
            <span>
              Request volume is expected to peak <span className="font-bold">this week</span> with approximately <span className="font-bold">25 requests</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
            <span>
              Transcript of records requests show <span className="font-bold">+8% growth trend</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
            <span>
              Model accuracy based on last 4 weeks: <span className="font-bold">87% confidence</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
