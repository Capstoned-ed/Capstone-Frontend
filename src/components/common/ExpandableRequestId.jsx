import React, { useState } from 'react';

export function formatCompactRequestId(id, maxLen = 20) {
  const str = String(id || '').trim();
  if (!str || str.length <= maxLen) return str;
  return `${str.slice(0, 14)}…${str.slice(-4)}`;
}

/**
 * Displays a Request / Tracking ID as a clean monospace pill.
 * Long IDs (> 20 chars) collapse the middle hash and expand to the full ID on click.
 */
export default function ExpandableRequestId({ id, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const str = String(id || '').trim();
  if (!str) return null;

  const isLong = str.length > 20;
  const baseClass =
    'inline-block px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-mono text-[11px] font-bold text-slate-900 leading-tight text-left';

  if (!isLong) {
    return <span className={`${baseClass} whitespace-nowrap ${className}`}>{str}</span>;
  }

  return (
    <button
      type="button"
      className={`${baseClass} cursor-pointer transition-colors hover:bg-indigo-50 hover:border-indigo-200 ${
        expanded ? 'max-w-[240px] whitespace-normal break-all' : 'whitespace-nowrap'
      } ${className}`}
      title={expanded ? 'Click to collapse ID' : `Click to view full ID: ${str}`}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
      }}
    >
      {expanded ? str : formatCompactRequestId(str)}
    </button>
  );
}
