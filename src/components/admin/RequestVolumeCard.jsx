import React, { useState } from 'react';

export default function RequestVolumeCard({ dailyData = [], monthlyData = [], loading = false }) {
  const [activePeriod, setActivePeriod] = useState('monthly');
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  const isMonthly = activePeriod === 'monthly';
  const currentData = isMonthly ? monthlyData : dailyData;

  // Colors matching the photo legend exactly
  const colors = {
    transcript: '#001FD1', // Vibrant deep blue
    dismissal: '#EAB308',  // Yellow / Gold
    evaluation: '#F97316', // Orange
    car: '#FF0000',        // Vibrant Red (CAR)
    enrolled: '#7088FF',   // Periwinkle / Light Blue
    totalLine: '#000000',  // Black Line
  };

  // SVG Chart Geometry
  const svgWidth = isMonthly ? 840 : 720;
  const svgHeight = 310;
  const paddingLeft = 52;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 42;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Calculate dynamic max value for scaling
  const maxDataVal = Math.max(
    0,
    ...currentData.map((d) =>
      Math.max(
        d.totalLine || 0,
        (d.transcript || 0) +
          (d.dismissal || 0) +
          (d.evaluation || 0) +
          (d.car || 0) +
          (d.enrolled || 0)
      )
    )
  );

  const baseMaxY = isMonthly ? 900 : 45;
  const maxY = Math.max(
    baseMaxY,
    maxDataVal > 0 ? Math.ceil((maxDataVal * 1.1) / (isMonthly ? 100 : 5)) * (isMonthly ? 100 : 5) : baseMaxY
  );

  const yTicks = Array.from({ length: 10 }, (_, i) => Math.round((maxY / 9) * (9 - i)));

  const getYCoord = (val) => paddingTop + chartHeight - (val / maxY) * chartHeight;
  const getXCoord = (index) =>
    currentData.length > 0
      ? paddingLeft + (index + 0.5) * (chartWidth / currentData.length)
      : paddingLeft;

  // Line path points
  const linePoints =
    currentData.length > 0
      ? currentData.map((d, i) => `${getXCoord(i)},${getYCoord(d.totalLine || 0)}`).join(' ')
      : '';

  const barWidth = isMonthly ? 36 : 42;

  // Dynamic calculations for "View All" details
  const totalVolumeCount = currentData.reduce((acc, curr) => acc + (curr.totalLine || 0), 0);
  const peakItem = currentData.reduce((max, curr) => ((curr.totalLine || 0) > (max?.totalLine || 0) ? curr : max), currentData[0] || {});

  const totalTypes = {
    'Transcript of Records': currentData.reduce((acc, c) => acc + (c.transcript || 0), 0),
    'Honorable Dismissal': currentData.reduce((acc, c) => acc + (c.dismissal || 0), 0),
    'Evaluation': currentData.reduce((acc, c) => acc + (c.evaluation || 0), 0),
    'CAR': currentData.reduce((acc, c) => acc + (c.car || 0), 0),
    'Officially Enrolled': currentData.reduce((acc, c) => acc + (c.enrolled || 0), 0),
  };
  const topCredentialName =
    totalVolumeCount > 0
      ? Object.entries(totalTypes).reduce(
          (max, [name, count]) => (count > max.count ? { name, count } : max),
          { name: 'None', count: 0 }
        ).name
      : 'None yet';

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
      {/* Header: Title & Daily/Monthly Toggle matching the photo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Request Volume
        </h3>

        {/* Toggle buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActivePeriod('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isMonthly
                ? 'bg-[#0B0B36] text-white shadow-xs'
                : 'text-[#1D4ED8] hover:text-blue-800'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setActivePeriod('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isMonthly
                ? 'bg-[#0B0B36] text-white shadow-xs'
                : 'text-[#1D4ED8] hover:text-blue-800'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Legend Row matching the photo */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-medium text-slate-600 mb-6">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.transcript }} />
          <span>Transcript of records</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.dismissal }} />
          <span>Honorable Dismissal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.evaluation }} />
          <span>Evaluation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.car }} />
          <span>CAR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.enrolled }} />
          <span>Officially enrolled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-black" />
          <span>Total (line)</span>
        </div>
      </div>

      {/* Loading State Skeleton */}
      {loading ? (
        <div className="w-full h-[310px] bg-slate-50/80 rounded-xl flex items-center justify-center animate-pulse">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="w-5 h-5 border-2 border-[#0B0B36] border-t-transparent rounded-full animate-spin" />
            <span>Loading dynamic request volume analytics...</span>
          </div>
        </div>
      ) : currentData.length === 0 ? (
        <div className="w-full h-[220px] flex items-center justify-center text-xs text-slate-400">
          No request volume data available for this timeframe.
        </div>
      ) : (
        /* The Chart (SVG) */
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[640px] select-none"
          >
            {/* Y Axis Grid Lines & Tick Labels */}
            {yTicks.map((tick) => {
              const y = getYCoord(tick);
              return (
                <g key={tick}>
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
                  key={d.label}
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="cursor-pointer"
                >
                  {/* Segments: Stacked bottom to top */}
                  {(d.enrolled || 0) > 0 && (
                    <rect
                      x={x}
                      y={enrolledY}
                      width={barWidth}
                      height={enrolledH}
                      fill={colors.enrolled}
                    />
                  )}
                  {(d.car || 0) > 0 && (
                    <rect
                      x={x}
                      y={carY}
                      width={barWidth}
                      height={carH}
                      fill={colors.car}
                    />
                  )}
                  {(d.evaluation || 0) > 0 && (
                    <rect
                      x={x}
                      y={evalY}
                      width={barWidth}
                      height={evalH}
                      fill={colors.evaluation}
                    />
                  )}
                  {(d.dismissal || 0) > 0 && (
                    <rect
                      x={x}
                      y={dismY}
                      width={barWidth}
                      height={dismH}
                      fill={colors.dismissal}
                    />
                  )}
                  {(d.transcript || 0) > 0 && (
                    <rect
                      x={x}
                      y={tranY}
                      width={barWidth}
                      height={tranH}
                      fill={colors.transcript}
                    />
                  )}

                  {/* X Axis Label */}
                  <text
                    x={getXCoord(i)}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    className="text-xs sm:text-sm fill-slate-700 font-semibold font-sans"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Total Line Graph Overlay */}
            {linePoints && (
              <polyline
                fill="none"
                stroke="#000000"
                strokeWidth="2.5"
                points={linePoints}
              />
            )}

            {/* Line Data Points */}
            {currentData.map((d, i) => {
              const cx = getXCoord(i);
              const cy = getYCoord(d.totalLine || 0);
              return (
                <circle
                  key={`point-${d.label}`}
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  fill="#000000"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className="cursor-pointer hover:scale-125 transition-transform"
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Hover Info Tooltip */}
      {hoveredItem && (
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-slate-700 animate-fadeIn">
          <span className="font-bold text-slate-900">{hoveredItem.label} Breakdown:</span>
          <span>Transcript: <strong>{hoveredItem.transcript || 0}</strong></span>
          <span>Dismissal: <strong>{hoveredItem.dismissal || 0}</strong></span>
          <span>Evaluation: <strong>{hoveredItem.evaluation || 0}</strong></span>
          <span>CAR: <strong>{hoveredItem.car || 0}</strong></span>
          <span>Enrolled: <strong>{hoveredItem.enrolled || 0}</strong></span>
          <span className="text-[#0B0B36] font-bold">Total Requests: {hoveredItem.totalLine || 0}</span>
        </div>
      )}

      {/* "View All v" accordion/toggle button matching the photo */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowAllDetails(!showAllDetails)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B0B36] hover:text-indigo-800 transition-colors py-1 px-3 rounded-lg hover:bg-slate-50 cursor-pointer"
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
          <div className="mt-4 pt-4 border-t border-slate-100 text-left text-xs text-slate-600 space-y-2 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isMonthly ? 'Annual Total Requests' : 'Weekly Total Requests'}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {totalVolumeCount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Peak Volume</p>
                <p className="text-lg font-bold text-indigo-700">
                  {totalVolumeCount > 0 && peakItem?.totalLine > 0
                    ? `${peakItem.label} (${peakItem.totalLine} requests)`
                    : 'No requests yet'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Top Requested Credential</p>
                <p className="text-lg font-bold text-slate-900">{topCredentialName}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Average Processing Time</p>
                <p className="text-lg font-bold text-emerald-600">
                  {totalVolumeCount > 0 ? '2.25 Days' : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
