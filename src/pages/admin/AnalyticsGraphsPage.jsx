import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import requestsApi, { isValidRequest, resolveRequestDocType, extractDocumentItems } from '../../api/requests';
import useSilentSync from '../../hooks/useSilentSync';
import useToast from '../../hooks/useToast';
import '../../styles/admin/AnalyticsGraphsPage.css';

// Institutional palette used deterministically for dynamically discovered document types
const SERIES_COLOR_PALETTE = [
  '#001FD1',
  '#EAB308',
  '#F97316',
  '#10B981',
  '#7088FF',
  '#8B5CF6',
  '#06B6D4',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
  '#84CC16',
];

function makeSeriesKey(label) {
  return String(label || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'other';
}

function makeShortLabel(label) {
  const s = String(label || '').trim();
  if (/transcript/i.test(s)) return 'TOR';
  if (/honorable|dismissal/i.test(s)) return 'Dismissal';
  if (/evaluation/i.test(s)) return 'Evaluation';
  if (/authentication/i.test(s)) return 'Auth';
  if (/officially\s*enrolled/i.test(s)) return 'Enrolled';
  if (s.length > 18) return `${s.slice(0, 16)}…`;
  return s;
}

// Helper to safely convert an ISO string, Date object, or date string into local YYYY-MM-DD
function toLocalDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return typeof val === 'string' ? val.split('T')[0] : '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

// Function to compute clean, integer Y-axis ticks scaled to data
function computeYAxis(maxVal, isMonthly) {
  if (maxVal <= 0) {
    const defaultMax = isMonthly ? 10 : 5;
    const ticks = Array.from({ length: 6 }, (_, i) => Math.round((defaultMax / 5) * (5 - i)));
    return { maxY: defaultMax, yTicks: ticks };
  }

  let targetMax = maxVal;
  if (targetMax <= 5) targetMax = 5;
  else if (targetMax <= 10) targetMax = 10;
  else if (targetMax <= 20) targetMax = 20;
  else if (targetMax <= 50) targetMax = 50;
  else if (targetMax <= 100) targetMax = 100;
  else if (targetMax <= 250) targetMax = 250;
  else if (targetMax <= 500) targetMax = 500;
  else if (targetMax <= 1000) targetMax = 1000;
  else targetMax = Math.ceil(targetMax / 100) * 100;

  const steps = targetMax <= 5 ? 5 : targetMax <= 10 ? 5 : targetMax <= 20 ? 4 : 5;
  const stepSize = targetMax / steps;
  const ticks = [];
  for (let i = steps; i >= 0; i--) {
    ticks.push(Math.round(i * stepSize));
  }
  return { maxY: targetMax, yTicks: ticks };
}

export default function AnalyticsGraphsPage() {
  // Always starts on Daily View when first opened
  const [viewMode, setViewMode] = useState('daily');
  const [hoveredItem, setHoveredItem] = useState(null);
  const [lineHoveredItem, setLineHoveredItem] = useState(null);

  const cachedInitialRequests = requestsApi.getCachedList();
  const cachedInitialCredTypes = requestsApi.getCachedCredentialTypes();
  const hasInitialCache = Boolean(cachedInitialRequests && cachedInitialRequests.length > 0);

  const [requestsList, setRequestsList] = useState(() => (cachedInitialRequests ? cachedInitialRequests.filter(isValidRequest) : []));
  const [credTypes, setCredTypes] = useState(() => cachedInitialCredTypes || []);
  const [loading, setLoading] = useState(!hasInitialCache);

  // Load real-time dynamic requests and credential types
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !requestsApi.getCachedList()?.length) {
        setLoading(true);
      }
      const [backendRequests, typesRes] = await Promise.all([
        requestsApi.list().catch(() => []),
        requestsApi.getCredentialTypes().catch(() => []),
      ]);

      const combined = Array.isArray(backendRequests) ? backendRequests : [];

      setRequestsList(combined.filter(isValidRequest));
      setCredTypes(Array.isArray(typesRes) ? typesRes : []);
    } catch (err) {
      console.warn('Analytics data load notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useSilentSync(loadData, { intervalMs: 12000 });

  // Resolve EVERY requested document item inside a request (supports multi-document requests + copies)
  const resolveRequestDocItems = useCallback(
    (req) => {
      const rawItems = extractDocumentItems(req, credTypes);
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems.map((it) => {
          const matchedCred = credTypes.find(
            (c) =>
              (it.credential_type_id && String(c.id) === String(it.credential_type_id)) ||
              (it.code && c.code && String(c.code).toUpperCase() === String(it.code).toUpperCase()) ||
              (it.name && c.name && String(c.name).toLowerCase() === String(it.name).toLowerCase())
          );
          const label = String(matchedCred?.name || it.name || 'Other Document').trim();
          const copies = Math.max(1, parseInt(it.copies ?? 1, 10) || 1);
          return {
            key: makeSeriesKey(label),
            label,
            copies,
          };
        });
      }
      const credId = req?.credential_type || req?.credential;
      const matchedCred = credTypes.find(
        (c) =>
          c.id === credId ||
          String(c.id) === String(credId) ||
          (c.code && String(c.code).toUpperCase() === String(credId || '').toUpperCase())
      );
      const label = String(
        matchedCred?.name ||
          req?.credential_name ||
          resolveRequestDocType(req, matchedCred) ||
          'Other Document'
      ).trim();
      return [{ key: makeSeriesKey(label), label, copies: 1 }];
    },
    [credTypes]
  );

  // Build series list from ALL catalog credential types + any extra requested document items
  const allDynamicSeries = useMemo(() => {
    const map = new Map();
    const addEntry = (label) => {
      const cleanLabel = String(label || '').trim();
      if (!cleanLabel) return;
      const key = makeSeriesKey(cleanLabel);
      if (!map.has(key)) {
        const idx = map.size;
        map.set(key, {
          key,
          label: cleanLabel,
          shortLabel: makeShortLabel(cleanLabel),
          color: SERIES_COLOR_PALETTE[idx % SERIES_COLOR_PALETTE.length],
        });
      }
    };

    credTypes.forEach((ct) => {
      if (ct?.name) addEntry(ct.name);
    });

    requestsList.forEach((r) => {
      const items = resolveRequestDocItems(r);
      items.forEach(({ label }) => addEntry(label));
    });
    return Array.from(map.values());
  }, [credTypes, requestsList, resolveRequestDocItems]);

  // Helper to build Mon-Sun week buckets around an anchor date
  const buildWeekBuckets = useCallback((anchorDate) => {
    const dayOfWeek = (anchorDate.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
    const monday = new Date(anchorDate);
    monday.setDate(anchorDate.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysData = dayLabels.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, shortDate, dateStr: toLocalDateStr(d), counts: {}, totalLine: 0 };
    });

    const dateIndexMap = {};
    daysData.forEach((item, idx) => {
      dateIndexMap[item.dateStr] = idx;
    });

    requestsList.forEach((r) => {
      const reqDateStr = toLocalDateStr(r.created_at || r.request_date);
      if (reqDateStr && dateIndexMap[reqDateStr] !== undefined) {
        const idx = dateIndexMap[reqDateStr];
        const items = resolveRequestDocItems(r);
        items.forEach(({ key, copies }) => {
          daysData[idx].counts[key] = (daysData[idx].counts[key] || 0) + copies;
          daysData[idx].totalLine += copies;
        });
      }
    });

    return daysData;
  }, [requestsList, resolveRequestDocItems]);

  // Purely dynamic daily data (Mon through Sun of current week, or latest request's week if current week is empty)
  const dynamicDailyData = useMemo(() => {
    const currentWeek = buildWeekBuckets(new Date());
    const hasCurrentWeekData = currentWeek.some((d) => d.totalLine > 0);
    if (hasCurrentWeekData || requestsList.length === 0) {
      return currentWeek;
    }
    // If current week has 0 records but DB has live requests, anchor to most recent request's week
    let latestTs = 0;
    requestsList.forEach((r) => {
      const ds = toLocalDateStr(r.created_at || r.request_date);
      if (ds) {
        const ts = new Date(`${ds}T12:00:00`).getTime();
        if (!isNaN(ts) && ts > latestTs) latestTs = ts;
      }
    });
    return latestTs > 0 ? buildWeekBuckets(new Date(latestTs)) : currentWeek;
  }, [buildWeekBuckets, requestsList]);

  // Purely dynamic monthly data (Jan through Dec of current year, or latest request's year if current year is empty)
  const dynamicMonthlyData = useMemo(() => {
    const buildYearBuckets = (targetYear) => {
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsData = monthLabels.map((label) => ({ label, year: targetYear, counts: {}, totalLine: 0 }));

      requestsList.forEach((r) => {
        const reqDateStr = toLocalDateStr(r.created_at || r.request_date);
        if (!reqDateStr) return;
        const [y, m] = reqDateStr.split('-').map(Number);
        if (y === targetYear && m >= 1 && m <= 12) {
          const monthIdx = m - 1;
          const items = resolveRequestDocItems(r);
          items.forEach(({ key, copies }) => {
            monthsData[monthIdx].counts[key] = (monthsData[monthIdx].counts[key] || 0) + copies;
            monthsData[monthIdx].totalLine += copies;
          });
        }
      });

      return monthsData;
    };

    const currentYear = new Date().getFullYear();
    const currentYearData = buildYearBuckets(currentYear);
    if (currentYearData.some((m) => m.totalLine > 0) || requestsList.length === 0) {
      return currentYearData;
    }

    let latestYear = currentYear;
    let latestTs = 0;
    requestsList.forEach((r) => {
      const ds = toLocalDateStr(r.created_at || r.request_date);
      if (ds) {
        const ts = new Date(`${ds}T12:00:00`).getTime();
        if (!isNaN(ts) && ts > latestTs) {
          latestTs = ts;
          latestYear = Number(ds.split('-')[0]) || currentYear;
        }
      }
    });
    return buildYearBuckets(latestYear);
  }, [requestsList, resolveRequestDocItems]);

  const isMonthly = viewMode === 'monthly';
  const currentData = isMonthly ? dynamicMonthlyData : dynamicDailyData;
  const activeSeries = useMemo(
    () =>
      allDynamicSeries.filter((series) =>
        currentData.some((d) => (d.counts[series.key] || 0) > 0)
      ),
    [allDynamicSeries, currentData]
  );

  // Chart Geometry & Dynamic Scales
  const svgWidth = isMonthly ? 860 : 720;
  const svgHeight = 310;
  const paddingLeft = 52;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 42;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Compute dynamic max value and integer ticks
  const maxDataVal = Math.max(0, ...currentData.map((d) => d.totalLine || 0));
  const { maxY, yTicks } = useMemo(() => computeYAxis(maxDataVal, isMonthly), [maxDataVal, isMonthly]);

  const getYCoord = (val) => paddingTop + chartHeight - (val / maxY) * chartHeight;
  const getXCoord = (index) =>
    currentData.length > 0
      ? paddingLeft + (index + 0.5) * (chartWidth / currentData.length)
      : paddingLeft;

  const barWidth = isMonthly ? 34 : 42;

  // Line Chart Path
  const linePoints = currentData.map((d, i) => `${getXCoord(i)},${getYCoord(d.totalLine)}`).join(' ');

  // Table Totals & Period Range Label
  const grandTotal = currentData.reduce((sum, d) => sum + d.totalLine, 0);
  const breakdownPeriodLabel = useMemo(() => {
    if (isMonthly) {
      const yr = dynamicMonthlyData[0]?.year || new Date().getFullYear();
      return `January – December ${yr}`;
    }
    const firstStr = dynamicDailyData[0]?.dateStr;
    const lastStr = dynamicDailyData[dynamicDailyData.length - 1]?.dateStr;
    if (!firstStr || !lastStr) return '';
    const firstDate = new Date(`${firstStr}T12:00:00`);
    const lastDate = new Date(`${lastStr}T12:00:00`);
    const fromText = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const toText = lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fromText} – ${toText}`;
  }, [isMonthly, dynamicDailyData, dynamicMonthlyData]);

  const toast = useToast();
  const breakdownCardRef = useRef(null);
  const breakdownTableRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrintBreakdown = () => {
    const tableEl = breakdownTableRef.current;
    if (!tableEl) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const monthlyCompact = isMonthly
      ? `
        .breakdown-table th, .breakdown-table td {
          padding: 12px 4px;
          font-size: 10.5px;
        }
        .th-doc-type, .td-doc-type {
          min-width: 135px;
        }
      `
      : `
        .breakdown-table th, .breakdown-table td {
          padding: 14px 6px;
          font-size: 12px;
        }
        .th-doc-type, .td-doc-type {
          min-width: 165px;
        }
      `;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title></title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html {
        margin: 0;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 10mm;
        background: #ffffff;
        color: #000000;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-variant-numeric: tabular-nums;
      }
      .breakdown-table {
        width: 100%;
        border-collapse: collapse;
        border: 1.5px solid #000000;
        background: #ffffff;
        color: #000000;
        text-align: center;
        page-break-inside: avoid;
      }
      .breakdown-table th,
      .breakdown-table td {
        border: 1px solid #000000;
        background: #ffffff;
        color: #000000;
      }
      ${monthlyCompact}
      .breakdown-thead th {
        font-weight: 700;
        border-bottom: 1.5px solid #000000;
      }
      .breakdown-period-row th {
        text-align: left;
        font-weight: 700;
        padding: 7px 10px;
        border-bottom: 1.5px solid #000000;
      }
      .th-doc-type,
      .td-doc-type {
        text-align: left;
        padding-left: 10px !important;
        font-weight: 600;
      }
      .th-total,
      .td-total {
        font-weight: 700;
      }
      .breakdown-total-row td {
        font-weight: 800;
        border-top: 1.5px solid #000000;
        border-bottom: 1.5px solid #000000;
      }
      .text-\\[10px\\] {
        font-size: 9px;
        font-weight: 500;
        margin-top: 2px;
      }
    </style>
  </head>
  <body>
    ${tableEl.outerHTML}
  </body>
</html>`);
    doc.close();

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(cleanup, 1500);
      }
    }, 100);
  };

  const handleDownloadBreakdownCsv = () => {
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      'Document Type',
      ...currentData.map((col) => (col.shortDate ? `${col.label} (${col.shortDate})` : col.label)),
      'Total',
    ];
    const rows = allDynamicSeries.map((row) => {
      const rowTotal = currentData.reduce((sum, col) => sum + (col.counts[row.key] || 0), 0);
      return [
        row.label,
        ...currentData.map((col) => col.counts[row.key] || 0),
        rowTotal,
      ];
    });
    const totalRow = ['Total', ...currentData.map((col) => col.totalLine), grandTotal];
    const csvLines = [headers, ...rows, totalRow]
      .map((line) => line.map(escapeCsv).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `USTP_Document_Breakdown_${isMonthly ? 'Monthly' : 'Daily'}_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Document Type Breakdown CSV downloaded!');
  };

  const handleDownloadBreakdownPdf = async () => {
    const cardEl = breakdownCardRef.current;
    const tableEl = breakdownTableRef.current;
    if (!tableEl || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      cardEl?.classList.add('breakdown-exporting');
      tableEl.classList.add('breakdown-table-exporting');
      const captureWidth = Math.max(tableEl.scrollWidth + 24, 760);
      const canvas = await html2canvas(tableEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: captureWidth,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      let imgW = availW;
      let imgH = (canvas.height * imgW) / canvas.width;
      if (imgH > availH) {
        const ratio = availH / imgH;
        imgW *= ratio;
        imgH = availH;
      }
      const x = (pageW - imgW) / 2;
      const y = margin;
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      const dateStamp = new Date().toISOString().split('T')[0];
      pdf.save(`USTP_Document_Breakdown_${isMonthly ? 'Monthly' : 'Daily'}_${dateStamp}.pdf`);
      toast.success('Document Type Breakdown PDF downloaded!');
    } catch (err) {
      console.error('Failed to export Document Breakdown PDF:', err);
      toast.error('Could not generate PDF. You can use Print or CSV instead.');
    } finally {
      tableEl.classList.remove('breakdown-table-exporting');
      cardEl?.classList.remove('breakdown-exporting');
      setDownloadingPdf(false);
    }
  };

  const colors = {
    transcript: '#001FD1',
    dismissal: '#EAB308',
    evaluation: '#F97316',
    car: '#FF0000',
    enrolled: '#7088FF',
    totalLine: '#000000',
    blueLine: '#0066FF',
  };

  return (
    <div className="analytics-page-wrapper">
      {/* ------------------------------------------------------------------
          1. Header Card: Icon, Title, Subtitle & Daily/Monthly Switcher
          ------------------------------------------------------------------ */}
      <div className="analytics-header-card">
        <div className="analytics-header-left">
          <div className="analytics-icon-box">
            <svg
              className="analytics-icon-svg"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="analytics-title-group">
            <h1 className="analytics-page-title">Analytics &amp; Graphs</h1>
            <p className="analytics-page-subtitle">Document request trends and insights</p>
          </div>
        </div>

        {/* Daily View / Monthly View Toggle */}
        <div className="analytics-toggle-group">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`analytics-toggle-btn ${!isMonthly ? 'is-active' : ''}`}
          >
            Daily View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`analytics-toggle-btn ${isMonthly ? 'is-active' : ''}`}
          >
            Monthly View
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          2. Card 1: Request Volume (Stacked Bar Chart)
          ------------------------------------------------------------------ */}
      <div className="analytics-card">
        <h2 className="analytics-card-title">Request Volume</h2>

        {/* Legend Row (only credentials with requests in current period) */}
        <div className="analytics-legend-row">
          {activeSeries.map((series) => (
            <div key={series.key} className="analytics-legend-item">
              <span className="analytics-legend-box" style={{ backgroundColor: series.color }} />
              <span>{series.label}</span>
            </div>
          ))}
        </div>

        {/* Stacked Bar Chart SVG */}
        <div className="analytics-chart-wrap">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="analytics-chart-svg">
            {/* Horizontal Grid lines & Y-axis labels */}
            {yTicks.map((tick) => {
              const y = getYCoord(tick);
              return (
                <g key={`bar-tick-${tick}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[12px] fill-slate-500 font-medium font-sans"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Stacked Bars */}
            {currentData.map((d, i) => {
              const x = getXCoord(i) - barWidth / 2;
              let currentBottom = 0;

              return (
                <g
                  key={`bar-group-${d.label}`}
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="cursor-pointer"
                >
                  {activeSeries.map((series) => {
                    const val = d.counts[series.key] || 0;
                    if (val <= 0) return null;
                    const segH = (val / maxY) * chartHeight;
                    const segY = getYCoord(currentBottom + val);
                    currentBottom += val;
                    return (
                      <rect
                        key={`seg-${series.key}`}
                        x={x}
                        y={segY}
                        width={barWidth}
                        height={segH}
                        fill={series.color}
                      />
                    );
                  })}

                  {/* X-axis label */}
                  <text
                    x={getXCoord(i)}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    className="text-xs fill-slate-700 font-semibold font-sans"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Tooltip (always rendered to prevent layout shift on hover) */}
        <div className="analytics-tooltip">
          {hoveredItem ? (
            <>
              <span className="font-bold text-slate-900">{hoveredItem.label} Breakdown:</span>
              {activeSeries.filter((s) => (hoveredItem.counts[s.key] || 0) > 0).map((series) => (
                <span key={series.key}>
                  {series.shortLabel}: <strong>{hoveredItem.counts[series.key] || 0}</strong>
                </span>
              ))}
              <span className="text-[#0B0B36] font-extrabold">Total: {hoveredItem.totalLine}</span>
            </>
          ) : (
            <span className="text-slate-400">Hover over a bar to view document breakdown.</span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
          3. Card 2: Monthly Total Request / Daily Total Request (Line Chart)
          ------------------------------------------------------------------ */}
      <div className="analytics-line-chart-card">
        <h2 className="analytics-card-title">
          {isMonthly ? 'Monthly Total Request' : 'Daily Total Request'}
        </h2>

        <div className="analytics-chart-wrap">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="analytics-chart-svg">
            {/* Horizontal Grid lines & Y-axis labels */}
            {yTicks.map((tick) => {
              const y = getYCoord(tick);
              return (
                <g key={`line-tick-${tick}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[12px] fill-slate-500 font-medium font-sans"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Blue Line Path connecting points */}
            {linePoints && (
              <polyline
                fill="none"
                stroke={colors.blueLine}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePoints}
              />
            )}

            {/* Blue circular markers on each data point */}
            {currentData.map((d, i) => {
              const cx = getXCoord(i);
              const cy = getYCoord(d.totalLine);
              const isHovered = lineHoveredItem?.label === d.label;

              return (
                <g key={`blue-dot-${d.label}`}>
                  <g
                    onMouseEnter={() => setLineHoveredItem(d)}
                    onMouseLeave={() => setLineHoveredItem(null)}
                    className="cursor-pointer"
                  >
                    <circle cx={cx} cy={cy} r={12} fill="transparent" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6.5 : 4.5}
                      fill={colors.blueLine}
                      stroke="#FFFFFF"
                      strokeWidth={isHovered ? 2 : 1.5}
                      className="line-chart-marker"
                    />
                  </g>
                  {/* X-axis label */}
                  <text
                    x={cx}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    className="text-xs fill-slate-700 font-semibold font-sans"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="analytics-tooltip">
          {lineHoveredItem ? (
            <>
              <span className="font-bold text-slate-900">{lineHoveredItem.label}:</span>
              <span className="text-[#0066FF] font-black">{lineHoveredItem.totalLine} Total Requests</span>
            </>
          ) : (
            <span className="text-slate-400">Hover over a point to view total requests.</span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
          4. Card 3: Document Type Breakdown Table
          ------------------------------------------------------------------ */}
      <div ref={breakdownCardRef} className="analytics-table-card breakdown-print-section">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="analytics-card-title !mb-0">Document Type Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMonthly ? 'Monthly' : 'Weekly'} Summary ({breakdownPeriodLabel}) • Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden breakdown-no-export">
            <button
              type="button"
              onClick={handleDownloadBreakdownCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download breakdown as CSV"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBreakdownPdf}
              disabled={downloadingPdf}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-[#0B0B36] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download breakdown as PDF (A4 Bondpaper)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloadingPdf ? 'Exporting...' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintBreakdown}
              className="px-3 py-1.5 rounded-lg bg-[#0B0B36] hover:bg-[#1E1E6B] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print Document Type Breakdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="analytics-table-wrap">
          <table ref={breakdownTableRef} className={`breakdown-table ${isMonthly ? 'breakdown-table-monthly' : 'breakdown-table-weekly'}`}>
            <thead className="breakdown-thead">
              {breakdownPeriodLabel && (
                <tr className="breakdown-period-row">
                  <th colSpan={currentData.length + 2}>
                    {isMonthly ? 'Monthly Period' : 'Weekly Period'}: {breakdownPeriodLabel}
                  </th>
                </tr>
              )}
              <tr>
                <th className="th-doc-type">Document Type</th>
                {currentData.map((col) => (
                  <th key={`th-${col.label}`}>
                    <div>{col.label}</div>
                    {col.shortDate && (
                      <div className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                        {col.shortDate}
                      </div>
                    )}
                  </th>
                ))}
                <th className="th-total">Total</th>
              </tr>
            </thead>
            <tbody className="breakdown-tbody">
              {allDynamicSeries.length === 0 ? (
                <tr>
                  <td colSpan={currentData.length + 2} className="text-center text-slate-400 py-6">
                    No credential types configured in catalog.
                  </td>
                </tr>
              ) : (
                allDynamicSeries.map((row) => {
                  const rowTotal = currentData.reduce((sum, col) => sum + (col.counts[row.key] || 0), 0);
                  return (
                    <tr key={row.key}>
                      <td className="td-doc-type">{row.label}</td>
                      {currentData.map((col) => (
                        <td key={`${row.key}-${col.label}`}>{col.counts[row.key] || 0}</td>
                      ))}
                      <td className="td-total">{rowTotal.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}

              {/* Total Footer Row */}
              <tr className="breakdown-total-row">
                <td className="td-doc-type font-black">Total</td>
                {currentData.map((col) => (
                  <td key={`total-${col.label}`} className="font-black">
                    {col.totalLine}
                  </td>
                ))}
                <td className="td-total font-black text-slate-900">{grandTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
