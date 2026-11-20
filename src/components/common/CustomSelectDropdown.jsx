import React, { useState, useEffect, useRef } from 'react';

/**
 * Custom dropdown constrained to its container width so it never overflows cards on mobile.
 */
export default function CustomSelectDropdown({
  value,
  options = [],
  onChange,
  buttonClassName = '',
  wrapperClassName = 'w-full',
  placeholder = 'Select...',
  disabled = false,
  title,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

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

  const selectedOption = options.find((opt) => String(opt.value) === String(value ?? ''));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        tabIndex={disabled ? -1 : undefined}
        title={title}
        style={{ backgroundImage: 'none' }}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`${buttonClassName} w-full flex items-center justify-between gap-2 text-left ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="truncate min-w-0">{displayLabel}</span>
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-50 py-1">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value ?? '');
            const isOptDisabled = Boolean(opt.disabled);
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={isOptDisabled}
                onClick={() => {
                  if (isOptDisabled) return;
                  setOpen(false);
                  if (String(opt.value) !== String(value ?? '')) {
                    onChange(opt.value);
                  }
                }}
                className={`w-full text-left px-3 py-1.5 text-xs whitespace-normal break-words leading-snug transition-colors ${
                  isOptDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#0B0B36] text-white font-semibold cursor-pointer'
                    : 'text-slate-700 hover:bg-[#0B0B36]/10 hover:text-[#0B0B36] cursor-pointer'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
