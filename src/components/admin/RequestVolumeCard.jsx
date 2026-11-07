import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

// Function to compute clean, dynamic integer Y-axis ticks scaled to data
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

export default function RequestVolumeCard({
  dailyData = [],
  monthlyData = [],
  loading = false,
  initialPeriod = 'daily',
  viewMoreRoute,
  onViewMore,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activePeriod, setActivePeriod] = useState(initialPeriod);
  const [hoveredItem, setHoveredItem] = useState(null);

  const targetAnalyticsRoute =
    viewMoreRoute ||
    (user?.role === 'registrar' ? ROUTES.REGISTRAR.ANALYTICS : ROUTES.ADMIN.ANALYTICS);

  const handleViewMore = () => {
    if (typeof onViewMore === 'function') {
      onViewMore();
    } else if (targetAnalyticsRoute) {
      navigate(targetAnalyticsRoute);
    }
  };

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

  // SVG Chart Geometry - Expanded for larger, more prominent presentation
  const svgWidth = isMonthly ? 880 : 760;
  const svgHeight = 390;
  const paddingLeft = 56;
  const paddingRight = 32;
  const paddingTop = 28;
  const paddingBottom = 48;

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

  const { maxY, yTicks } = computeYAxis(maxDataVal, isMonthly);

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

  // Generous bar width so bars appear prominent and substantial
  const barWidth = isMonthly ? 40 : 64;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
      {/* Header: Title & Daily/Monthly Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Request Volume
        </h3>

        {/* Toggle buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActivePeriod('daily')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

      {/* Legend Row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 mb-6">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.transcript }} />
          <span>Transcript of Records</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.dismissal }} />
          <span>Honorable Dismissal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.evaluation }} />
          <span>Evaluation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.car }} />
          <span>CAR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.enrolled }} />
          <span>Officially Enrolled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-black" />
          <span>Total Requests (Line)</span>
        </div>
      </div>

      {/* Main Chart Area */}
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading volume records...</span>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[620px] select-none"
            style={{ maxHeight: '440px', minHeight: '330px' }}
          >
            {/* Horizontal Grid lines and Y-axis labels */}
            {yTicks.map((tickVal, i) => {
              const y = getYCoord(tickVal);
              return (
                <g key={`y-axis-${tickVal}-${i}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1.3"
                  />
                  <text
                    x={paddingLeft - 14}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94A3B8"
                    fontSize="11"
                    fontWeight="500"
                    fontFamily="inherit"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* Bars for Each Interval */}
            {currentData.map((d, i) => {
              const x = getXCoord(i) - barWidth / 2;
              let currentYOffset = paddingTop + chartHeight;

              const stackOrder = [
                { key: 'transcript', color: colors.transcript, val: d.transcript || 0 },
                { key: 'dismissal', color: colors.dismissal, val: d.dismissal || 0 },
                { key: 'evaluation', color: colors.evaluation, val: d.evaluation || 0 },
                { key: 'car', color: colors.car, val: d.car || 0 },
                { key: 'enrolled', color: colors.enrolled, val: d.enrolled || 0 },
              ];

              return (
                <g
                  key={`bar-group-${d.label}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {stackOrder.map((seg) => {
                    if (seg.val <= 0) return null;
                    const segHeight = (seg.val / maxY) * chartHeight;
                    currentYOffset -= segHeight;
                    return (
                      <rect
                        key={`seg-${seg.key}`}
                        x={x}
                        y={currentYOffset}
                        width={barWidth}
                        height={segHeight}
                        fill={seg.color}
                        opacity={hoveredItem && hoveredItem.label !== d.label ? 0.65 : 1}
                        className="transition-opacity duration-150"
                      />
                    );
                  })}

                  {/* X Axis Label */}
                  <text
                    x={getXCoord(i)}
                    y={svgHeight - 14}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="inherit"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Total Line (Black) */}
            {linePoints && (
              <polyline
                fill="none"
                stroke="#000000"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePoints}
              />
            )}

            {/* Total Line Dots */}
            {currentData.map((d, i) => {
              const cx = getXCoord(i);
              const cy = getYCoord(d.totalLine || 0);
              return (
                <circle
                  key={`point-${d.label}`}
                  cx={cx}
                  cy={cy}
                  r="5.5"
                  fill="#000000"
                  stroke="#FFFFFF"
                  strokeWidth="2"
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

      {/* "View More" button directed to Analytics & Graphs */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={handleViewMore}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0B0B36] hover:text-indigo-800 transition-colors py-2 px-4 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          <span>View More</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
