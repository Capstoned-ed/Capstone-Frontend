import React, { useState } from 'react';

export function formatCompactDocText(text, maxItems = 1) {
  const raw = String(text || '');
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= maxItems) return raw;
  return `${parts.slice(0, maxItems).join(', ')} +${parts.length - maxItems} more`;
}

export default function ExpandableDocList({
  text,
  maxItems = 1,
  className = '',
  badgeClassName = '',
}) {
  const [expanded, setExpanded] = useState(false);
  const raw = String(text || '');
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= maxItems) {
    return <span className={className}>{raw}</span>;
  }

  const extraCount = parts.length - maxItems;
  const pillClass =
    badgeClassName ||
    'px-1.5 py-0 rounded-full text-[10px] font-bold leading-4 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer transition-colors whitespace-nowrap';

  if (expanded) {
    return (
      <div className={`flex flex-col items-start gap-1 ${className}`} title={raw}>
        <ul className="w-full space-y-0.5 max-h-36 overflow-y-auto pr-1 text-xs leading-snug">
          {parts.map((part, idx) => (
            <li key={`${part}-${idx}`} className="flex items-start gap-1.5">
              <span className="text-blue-500 select-none">•</span>
              <span>{part}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className={pillClass}
        >
          Show less
        </button>
      </div>
    );
  }

  const visibleText = parts.slice(0, maxItems).join(', ');

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`} title={raw}>
      <span>{visibleText}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className={pillClass}
      >
        +{extraCount}
      </button>
    </span>
  );
}

/**
 * Renders a structured vertical list of requested documents with per-item copy badges.
 */
export function DocumentItemsList({ items = [], fallback = 'N/A' }) {
  if (!Array.isArray(items) || items.length <= 1) {
    return <span>{fallback || items?.[0]?.name || 'N/A'}</span>;
  }

  return (
    <ul className="w-full space-y-1.5 max-h-40 overflow-y-auto pr-1">
      {items.map((it, idx) => (
        <li
          key={`${it.name || 'doc'}-${idx}`}
          className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70 last:border-b-0 last:pb-0 text-xs"
        >
          <span className="font-semibold text-indigo-950">{it.name}</span>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-[11px] font-bold">
            {it.copies} {Number(it.copies) === 1 ? 'copy' : 'copies'}
          </span>
        </li>
      ))}
    </ul>
  );
}
