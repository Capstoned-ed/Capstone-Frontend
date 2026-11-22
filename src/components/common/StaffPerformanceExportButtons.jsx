import React, { useState } from 'react';
import useToast from '../../hooks/useToast';
import {
  downloadStaffPerformancePdf,
  printStaffPerformanceReport,
} from '../../utils/staffPerformanceExport';

export default function StaffPerformanceExportButtons({
  staffMetrics = [],
  periodLabel = '',
  columns = [],
  mode = 'weekly',
  onModeChange,
  showExport = true,
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading || staffMetrics.length === 0) return;
    setDownloading(true);
    try {
      await downloadStaffPerformancePdf(staffMetrics, periodLabel, columns, mode);
      toast.success('Staff Performance PDF downloaded!');
    } catch (err) {
      console.error('Failed to download staff performance PDF:', err);
      toast.error('Could not generate PDF. You can use Print instead.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (staffMetrics.length === 0) return;
    printStaffPerformanceReport(staffMetrics, periodLabel, columns, mode);
  };

  return (
    <div className="mb-4 space-y-2">
      {/* Row 1: Title aligned with Download & Print on the right */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="admin-card-title !mb-0">
          Staff Performance Metrics
        </h3>
        {showExport && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-[#0B0B36] text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Download Staff Performance PDF (A4 Bondpaper)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloading ? 'Exporting...' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B0B36] hover:bg-[#1E1E6B] text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="Print Staff Performance Report"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Subtitle & Weekly/Monthly toggle on the left */}
      <div className="space-y-2">
        <p className="admin-card-subtitle !mt-0">
          {mode === 'monthly' ? 'Monthly' : 'Weekly'} productivity{periodLabel ? ` • ${periodLabel}` : ''}
        </p>
        {onModeChange && (
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => onModeChange('weekly')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'weekly'
                  ? 'bg-[#0B0B36] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => onModeChange('monthly')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'monthly'
                  ? 'bg-[#0B0B36] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
