import React, { useState, useEffect, useRef } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseIsoDate(str) {
  if (!str || typeof str !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

function toIsoDate(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatDisplayDate(str) {
  const d = parseIsoDate(str);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/**
 * Compact, mobile-safe date picker constrained to its input container width.
 */
export default function CompactDatePicker({
  value = '',
  onChange,
  max,
  placeholder = 'mm/dd/yyyy',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // 'days' | 'months' | 'years'
  const containerRef = useRef(null);

  const parsedValue = parseIsoDate(value);
  const parsedMax = parseIsoDate(max);
  const today = new Date();
  const initialDate = parsedValue || parsedMax || today;

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(initialDate.getFullYear() / 12) * 12
  );

  useEffect(() => {
    if (!open) return;
    const d = parseIsoDate(value) || parseIsoDate(max) || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setYearPageStart(Math.floor(d.getFullYear() / 12) * 12);
    setMode('days');
  }, [open, value, max]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  const maxIso = parsedMax ? toIsoDate(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate()) : null;
  const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDate = (iso) => {
    if (maxIso && iso > maxIso) return;
    onChange(iso);
    setOpen(false);
  };

  const displayValue = formatDisplayDate(value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 text-left cursor-pointer ${className}`}
      >
        <span className={displayValue ? 'text-slate-800' : 'text-slate-400'}>
          {displayValue || placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full max-w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-1 pb-2 mb-1.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (mode === 'years') setYearPageStart((y) => y - 12);
                else if (mode === 'months') setViewYear((y) => y - 1);
                else handlePrevMonth();
              }}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Previous"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode((m) => (m === 'months' ? 'days' : 'months'))}
                className="px-2 py-0.5 rounded-md text-xs font-bold text-[#000080] hover:bg-[#000080]/10 cursor-pointer"
              >
                {MONTHS[viewMonth]}
              </button>
              <button
                type="button"
                onClick={() => {
                  setYearPageStart(Math.floor(viewYear / 12) * 12);
                  setMode((m) => (m === 'years' ? 'days' : 'years'));
                }}
                className="px-2 py-0.5 rounded-md text-xs font-bold text-[#000080] hover:bg-[#000080]/10 cursor-pointer"
              >
                {viewYear}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (mode === 'years') setYearPageStart((y) => y + 12);
                else if (mode === 'months') setViewYear((y) => y + 1);
                else handleNextMonth();
              }}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Next"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {mode === 'years' ? (
            <div className="grid grid-cols-3 gap-1 py-1">
              {Array.from({ length: 12 }, (_, idx) => yearPageStart + idx).map((yr) => {
                const isDisabled = parsedMax && yr > parsedMax.getFullYear();
                const isSelected = yr === viewYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setViewYear(yr);
                      setMode('months');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isDisabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#000080] text-white'
                        : 'text-slate-700 hover:bg-[#000080]/10 hover:text-[#000080] cursor-pointer'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          ) : mode === 'months' ? (
            <div className="grid grid-cols-3 gap-1 py-1">
              {SHORT_MONTHS.map((label, mIdx) => {
                const isDisabled =
                  parsedMax &&
                  (viewYear > parsedMax.getFullYear() ||
                    (viewYear === parsedMax.getFullYear() && mIdx > parsedMax.getMonth()));
                const isSelected = mIdx === viewMonth;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setViewMonth(mIdx);
                      setMode('days');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isDisabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#000080] text-white'
                        : 'text-slate-700 hover:bg-[#000080]/10 hover:text-[#000080] cursor-pointer'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="text-[10px] font-bold text-slate-400 py-0.5">
                    {wd}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                  <div key={`empty-${idx}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((day) => {
                  const iso = toIsoDate(viewYear, viewMonth, day);
                  const isDisabled = Boolean(maxIso && iso > maxIso);
                  const isSelected = value && value.startsWith(iso);
                  const isToday = iso === todayIso;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => selectDate(iso)}
                      className={`py-1 text-xs rounded-lg transition-colors ${
                        isDisabled
                          ? 'text-slate-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#000080] text-white font-bold'
                          : isToday
                          ? 'bg-[#000080]/10 text-[#000080] font-bold hover:bg-[#000080]/20 cursor-pointer'
                          : 'text-slate-700 hover:bg-[#000080]/10 hover:text-[#000080] cursor-pointer'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="px-2 py-0.5 font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={Boolean(maxIso && todayIso > maxIso)}
              onClick={() => selectDate(todayIso)}
              className="px-2 py-0.5 font-semibold text-[#000080] hover:bg-[#000080]/10 rounded cursor-pointer disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
