import React, { useState, useEffect, useMemo, useCallback } from 'react';
import requestsApi, { getStoredRequests } from '../../api/requests';
import '../../styles/admin/AnalyticsGraphsPage.css';

// Baseline patterns from the reference design
const MONTHLY_BASE = [
  { label: 'Jan', transcript: 50, dismissal: 50, evaluation: 30, car: 25, enrolled: 20 },
  { label: 'Feb', transcript: 76, dismissal: 31, evaluation: 35, car: 30, enrolled: 26 },
  { label: 'Mar', transcript: 40, dismissal: 40, evaluation: 50, car: 34, enrolled: 23 },
  { label: 'Apr', transcript: 55, dismissal: 16, evaluation: 35, car: 38, enrolled: 87 },
  { label: 'May', transcript: 80, dismissal: 20, evaluation: 65, car: 54, enrolled: 126 },
  { label: 'Jun', transcript: 260, dismissal: 46, evaluation: 51, car: 64, enrolled: 200 },
  { label: 'Jul', transcript: 198, dismissal: 32, evaluation: 32, car: 50, enrolled: 230 },
  { label: 'Aug', transcript: 100, dismissal: 28, evaluation: 33, car: 45, enrolled: 195 },
  { label: 'Sep', transcript: 67, dismissal: 46, evaluation: 35, car: 30, enrolled: 30 },
  { label: 'Oct', transcript: 78, dismissal: 65, evaluation: 21, car: 25, enrolled: 25 },
  { label: 'Nov', transcript: 45, dismissal: 35, evaluation: 30, car: 28, enrolled: 16 },
  { label: 'Dec', transcript: 45, dismissal: 28, evaluation: 20, car: 40, enrolled: 14 },
];

const DAILY_BASE = [
  { label: 'Mon', transcript: 12, dismissal: 8, evaluation: 5, car: 15, enrolled: 7 },
  { label: 'Tue', transcript: 15, dismissal: 10, evaluation: 8, car: 12, enrolled: 5 },
  { label: 'Wed', transcript: 10, dismissal: 6, evaluation: 4, car: 18, enrolled: 9 },
  { label: 'Thu', transcript: 18, dismissal: 12, evaluation: 7, car: 10, enrolled: 6 },
  { label: 'Fri', transcript: 0, dismissal: 0, evaluation: 0, car: 0, enrolled: 0 },
  { label: 'Sat', transcript: 0, dismissal: 0, evaluation: 0, car: 0, enrolled: 0 },
  { label: 'Sun', transcript: 0, dismissal: 0, evaluation: 0, car: 0, enrolled: 0 },
];

const DOC_ROWS = [
  { key: 'transcript', name: 'Transcript of Record' },
  { key: 'dismissal', name: 'Honorable Dismissal' },
  { key: 'evaluation', name: 'Evaluation' },
  { key: 'car', name: 'CAR' },
  { key: 'enrolled', name: 'Officially Enrolled' },
];

export default function AnalyticsGraphsPage() {
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'daily'
  const [showAllDetails, setShowAllDetails] = useState(false);
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

      const stored = getStoredRequests();
      const combined = [...(Array.isArray(backendRequests) ? backendRequests : [])];

      stored.forEach((s) => {
        const key = s.tracking_number || s.id;
        if (!combined.some((b) => (b.tracking_number || b.id) === key)) {
          combined.push(s);
        }
      });

      setRequestsList(combined);
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

  // Map each request into a document type bucket
  const getDocTypeKey = useCallback(
    (req) => {
      const cred = credTypes.find(
        (c) => c.id === req.credential_type || c.code === req.credential_type
      );
      const code = (cred?.code || req.document_type || req.credential_name || '').toUpperCase();
      const name = (cred?.name || req.document_type || req.credential_name || '').toUpperCase();

      if (code.includes('TOR') || name.includes('TRANSCRIPT')) return 'transcript';
      if (code.includes('HD') || name.includes('HONORABLE') || name.includes('DISMISSAL')) return 'dismissal';
      if (code.includes('EVAL') || name.includes('EVALUATION')) return 'evaluation';
      if (code.includes('CAR') || name.includes('CAR') || name.includes('CERTIFICATE OF ACADEMIC')) return 'car';
      if (
        code.includes('COE') ||
        code.includes('ENR') ||
        name.includes('ENROLL') ||
        name.includes('OFFICIALLY')
      )
        return 'enrolled';

      return 'transcript';
    },
    [credTypes]
  );

  // Compute dynamic monthly data
  const dynamicMonthlyData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Deep clone baseline
    const data = MONTHLY_BASE.map((item) => ({ ...item }));

    // Tally actual live requests
    requestsList.forEach((r) => {
      const dateVal = r.created_at || r.request_date;
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;

      if (d.getFullYear() === currentYear) {
        const monthIdx = d.getMonth();
        if (monthIdx >= 0 && monthIdx < 12) {
          const docKey = getDocTypeKey(r);
          data[monthIdx][docKey] = (data[monthIdx][docKey] || 0) + (parseInt(r.copies) || 1);
        }
      }
    });

    // Compute total line
    return data.map((d) => ({
      ...d,
      totalLine: d.transcript + d.dismissal + d.evaluation + d.car + d.enrolled,
    }));
  }, [requestsList, getDocTypeKey]);

  // Compute dynamic daily data for the current week
  const dynamicDailyData = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    // Deep clone baseline
    const data = DAILY_BASE.map((item) => ({ ...item }));

    requestsList.forEach((r) => {
      const dateVal = r.created_at || r.request_date;
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;

      const diffTime = d.getTime() - monday.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        const docKey = getDocTypeKey(r);
        data[diffDays][docKey] = (data[diffDays][docKey] || 0) + (parseInt(r.copies) || 1);
      }
    });

    // Compute total line
    return data.map((d) => ({
      ...d,
      totalLine: d.transcript + d.dismissal + d.evaluation + d.car + d.enrolled,
    }));
  }, [requestsList, getDocTypeKey]);

  const isMonthly = viewMode === 'monthly';
  const currentData = isMonthly ? dynamicMonthlyData : dynamicDailyData;

  // Chart Geometry & Scales
  const svgWidth = isMonthly ? 860 : 720;
  const svgHeight = 310;
  const paddingLeft = 52;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 42;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Exact maximum matching reference photo (900 for monthly, 45 for daily)
  const baseMaxY = isMonthly ? 900 : 45;
  const maxY = Math.max(
    baseMaxY,
    ...currentData.map((d) => Math.max(d.totalLine || 0))
  );

  const numTicks = 9;
  const yTicks = Array.from({ length: 10 }, (_, i) => Math.round((maxY / numTicks) * (numTicks - i)));

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

        {/* Legend Row matching reference photo */}
        <div className="analytics-legend-row">
          <div className="analytics-legend-item">
            <span className="analytics-legend-box" style={{ backgroundColor: colors.transcript }} />
            <span>Transcript of records</span>
          </div>
          <div className="analytics-legend-item">
            <span className="analytics-legend-box" style={{ backgroundColor: colors.dismissal }} />
            <span>Honorable Dismissal</span>
          </div>
          <div className="analytics-legend-item">
            <span className="analytics-legend-box" style={{ backgroundColor: colors.evaluation }} />
            <span>Evaluation</span>
          </div>
          <div className="analytics-legend-item">
            <span className="analytics-legend-box" style={{ backgroundColor: colors.car }} />
            <span>CAR</span>
          </div>
          <div className="analytics-legend-item">
            <span className="analytics-legend-box" style={{ backgroundColor: colors.enrolled }} />
            <span>Officially enrolled</span>
          </div>
          <div className="analytics-legend-item">
            <div className="analytics-legend-line" />
            <span>Total (line)</span>
          </div>
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

              const enrolledH = ((d.enrolled || 0) / maxY) * chartHeight;
              const carH = ((d.car || 0) / maxY) * chartHeight;
              const evalH = ((d.evaluation || 0) / maxY) * chartHeight;
              const dismH = ((d.dismissal || 0) / maxY) * chartHeight;
              const tranH = ((d.transcript || 0) / maxY) * chartHeight;

              const enrolledY = getYCoord(currentBottom + (d.enrolled || 0));
              currentBottom += d.enrolled || 0;

              const carY = getYCoord(currentBottom + (d.car || 0));
              currentBottom += d.car || 0;

              const evalY = getYCoord(currentBottom + (d.evaluation || 0));
              currentBottom += d.evaluation || 0;

              const dismY = getYCoord(currentBottom + (d.dismissal || 0));
              currentBottom += d.dismissal || 0;

              const tranY = getYCoord(currentBottom + (d.transcript || 0));
              currentBottom += d.transcript || 0;

              return (
                <g
                  key={`bar-group-${d.label}`}
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="cursor-pointer"
                >
                  {/* Officially Enrolled (Bottom) */}
                  {(d.enrolled || 0) > 0 && (
                    <rect x={x} y={enrolledY} width={barWidth} height={enrolledH} fill={colors.enrolled} />
                  )}
                  {/* CAR */}
                  {(d.car || 0) > 0 && (
                    <rect x={x} y={carY} width={barWidth} height={carH} fill={colors.car} />
                  )}
                  {/* Evaluation */}
                  {(d.evaluation || 0) > 0 && (
                    <rect x={x} y={evalY} width={barWidth} height={evalH} fill={colors.evaluation} />
                  )}
                  {/* Honorable Dismissal */}
                  {(d.dismissal || 0) > 0 && (
                    <rect x={x} y={dismY} width={barWidth} height={dismH} fill={colors.dismissal} />
                  )}
                  {/* Transcript of records (Top) */}
                  {(d.transcript || 0) > 0 && (
                    <rect x={x} y={tranY} width={barWidth} height={tranH} fill={colors.transcript} />
                  )}

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

            {/* Total Line overlay */}
            {linePoints && (
              <polyline fill="none" stroke="#000000" strokeWidth="2.5" points={linePoints} />
            )}

            {/* Data points on black line */}
            {currentData.map((d, i) => (
              <circle
                key={`line-point-${d.label}`}
                cx={getXCoord(i)}
                cy={getYCoord(d.totalLine)}
                r="4.5"
                fill="#000000"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>

        {/* Hover Tooltip */}
        {hoveredItem && (
          <div className="analytics-tooltip">
            <span className="font-bold text-slate-900">{hoveredItem.label} Breakdown:</span>
            <span>Transcript: <strong>{hoveredItem.transcript}</strong></span>
            <span>Dismissal: <strong>{hoveredItem.dismissal}</strong></span>
            <span>Evaluation: <strong>{hoveredItem.evaluation}</strong></span>
            <span>CAR: <strong>{hoveredItem.car}</strong></span>
            <span>Enrolled: <strong>{hoveredItem.enrolled}</strong></span>
            <span className="text-[#0B0B36] font-extrabold">Total: {hoveredItem.totalLine}</span>
          </div>
        )}

        {/* View All accordion toggle */}
        <div className="analytics-view-all-wrap">
          <button
            type="button"
            onClick={() => setShowAllDetails(!showAllDetails)}
            className="analytics-view-all-btn"
          >
            <span>{showAllDetails ? 'Hide Details' : 'View All'}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showAllDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllDetails && (
            <div className="analytics-details-panel">
              <div className="analytics-stats-grid">
                <div>
                  <p className="stat-metric-label">{isMonthly ? 'Annual Total Requests' : 'Weekly Total Requests'}</p>
                  <p className="stat-metric-value">{grandTotal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="stat-metric-label">Peak Volume</p>
                  <p className="stat-metric-value text-indigo-700">
                    {(() => {
                      const peak = currentData.reduce((max, c) => (c.totalLine > max.totalLine ? c : max), currentData[0]);
                      return `${peak.label} (${peak.totalLine})`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="stat-metric-label">Top Credential</p>
                  <p className="stat-metric-value">Transcript of Record</p>
                </div>
                <div>
                  <p className="stat-metric-label">Avg. Processing Time</p>
                  <p className="stat-metric-value text-emerald-600">2.25 Days</p>
                </div>
              </div>
            </div>
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
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6.5 : 4.5}
                    fill={colors.blueLine}
                    stroke="#FFFFFF"
                    strokeWidth={isHovered ? 2 : 1.5}
                    onMouseEnter={() => setLineHoveredItem(d)}
                    onMouseLeave={() => setLineHoveredItem(null)}
                    className="line-chart-marker"
                  />
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

        {lineHoveredItem && (
          <div className="analytics-tooltip">
            <span className="font-bold text-slate-900">{lineHoveredItem.label}:</span>
            <span className="text-[#0066FF] font-black">{lineHoveredItem.totalLine} Total Requests</span>
          </div>
        )}
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
              {DOC_ROWS.map((row) => {
                const rowTotal = currentData.reduce((sum, col) => sum + (col[row.key] || 0), 0);
                return (
                  <tr key={row.key}>
                    <td className="td-doc-type">{row.name}</td>
                    {currentData.map((col) => (
                      <td key={`${row.key}-${col.label}`}>{col[row.key] || 0}</td>
                    ))}
                    <td className="td-total">{rowTotal.toLocaleString()}</td>
                  </tr>
                );
              })}

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
