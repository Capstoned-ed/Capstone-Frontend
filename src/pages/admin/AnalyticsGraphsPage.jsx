import React, { useState, useEffect, useMemo, useCallback } from 'react';
import requestsApi, { getStoredRequests, isValidRequest } from '../../api/requests';
import {
  VOLUME_CREDENTIAL_SERIES,
  getVolumeDocKey,
  createEmptyVolumeBucket,
  sumVolumeBucket,
} from '../../api/credentialTypes';
import '../../styles/admin/AnalyticsGraphsPage.css';

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

const DOC_ROWS = VOLUME_CREDENTIAL_SERIES.map((s) => ({
  key: s.key,
  name: s.label,
}));

export default function AnalyticsGraphsPage() {
  // Always starts on Daily View when first opened
  const [viewMode, setViewMode] = useState('daily');
  const [hoveredItem, setHoveredItem] = useState(null);
  const [lineHoveredItem, setLineHoveredItem] = useState(null);

  const [requestsList, setRequestsList] = useState([]);
  const [credTypes, setCredTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load real-time dynamic requests and credential types
  const loadData = useCallback(async () => {
    try {
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

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('regquest_requests_updated', handleSync);
    return () => {
      window.removeEventListener('regquest_requests_updated', handleSync);
    };
  }, [loadData]);

  // Dynamically map each request to its corresponding document type key
  const getDocTypeKey = useCallback(
    (req) => getVolumeDocKey(req, credTypes),
    [credTypes]
  );

  // Purely dynamic daily data for the current week (Mon through Sun)
  const dynamicDailyData = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Initialize clean 7 days for the week
    const daysData = dayLabels.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = toLocalDateStr(d);
      return createEmptyVolumeBucket({ label, dateStr });
    });

    const dateIndexMap = {};
    daysData.forEach((item, idx) => {
      dateIndexMap[item.dateStr] = idx;
    });

    // Populate counts strictly from live requests
    requestsList.forEach((r) => {
      const reqDateStr = toLocalDateStr(r.request_date || r.created_at);
      if (reqDateStr && dateIndexMap[reqDateStr] !== undefined) {
        const idx = dateIndexMap[reqDateStr];
        const docKey = getDocTypeKey(r);
        const copies = parseInt(r.copies) || 1;
        daysData[idx][docKey] = (daysData[idx][docKey] || 0) + copies;
      }
    });

    return daysData.map((d) => ({
      ...d,
      totalLine: sumVolumeBucket(d),
    }));
  }, [requestsList, getDocTypeKey]);

  // Purely dynamic monthly data for the current year (Jan through Dec)
  const dynamicMonthlyData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize 12 months with 0
    const monthsData = monthLabels.map((label) => createEmptyVolumeBucket({ label }));

    // Populate counts strictly from live requests
    requestsList.forEach((r) => {
      const reqDateStr = toLocalDateStr(r.request_date || r.created_at);
      if (!reqDateStr) return;
      const [y, m] = reqDateStr.split('-').map(Number);
      if (y === currentYear && m >= 1 && m <= 12) {
        const monthIdx = m - 1;
        const docKey = getDocTypeKey(r);
        const copies = parseInt(r.copies) || 1;
        monthsData[monthIdx][docKey] = (monthsData[monthIdx][docKey] || 0) + copies;
      }
    });

    return monthsData.map((d) => ({
      ...d,
      totalLine: sumVolumeBucket(d),
    }));
  }, [requestsList, getDocTypeKey]);

  const isMonthly = viewMode === 'monthly';
  const currentData = isMonthly ? dynamicMonthlyData : dynamicDailyData;
  const activeSeries = useMemo(
    () =>
      VOLUME_CREDENTIAL_SERIES.filter((series) =>
        currentData.some((d) => (d[series.key] || 0) > 0)
      ),
    [currentData]
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

  // Table Totals
  const grandTotal = currentData.reduce((sum, d) => sum + d.totalLine, 0);

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
                  {VOLUME_CREDENTIAL_SERIES.map((series) => {
                    const val = d[series.key] || 0;
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
              {VOLUME_CREDENTIAL_SERIES.filter((s) => (hoveredItem[s.key] || 0) > 0).map((series) => (
                <span key={series.key}>
                  {series.shortLabel}: <strong>{hoveredItem[series.key] || 0}</strong>
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
      <div className="analytics-table-card">
        <h2 className="analytics-card-title">Document Type Breakdown</h2>

        <div className="analytics-table-wrap">
          <table className="breakdown-table">
            <thead className="breakdown-thead">
              <tr>
                <th className="th-doc-type">Document Type</th>
                {currentData.map((col) => (
                  <th key={`th-${col.label}`}>{col.label}</th>
                ))}
                <th className="th-total">Total</th>
              </tr>
            </thead>
            <tbody className="breakdown-tbody">
              {activeSeries.length === 0 ? (
                <tr>
                  <td colSpan={currentData.length + 2} className="text-center text-slate-400 py-6">
                    No credential requests recorded for this period.
                  </td>
                </tr>
              ) : (
                activeSeries.map((row) => {
                  const rowTotal = currentData.reduce((sum, col) => sum + (col[row.key] || 0), 0);
                  return (
                    <tr key={row.key}>
                      <td className="td-doc-type">{row.label}</td>
                      {currentData.map((col) => (
                        <td key={`${row.key}-${col.label}`}>{col[row.key] || 0}</td>
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
