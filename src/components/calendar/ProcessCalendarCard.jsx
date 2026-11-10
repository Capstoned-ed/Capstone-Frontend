import React, { useState, useMemo } from 'react';
import '../../styles/staff/ProcessingCalendar.css';

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

// Helper to safely format a Date object into local YYYY-MM-DD
function formatLocalDateToStr(d) {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

// Helper to add days to a YYYY-MM-DD date string safely without timezone drift
function addDaysToDateStr(dateStr, numDays) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + numDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

// Helper to calculate days between two YYYY-MM-DD date strings
function getDaysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

// Helper to format YYYY-MM-DD into readable date e.g. "April 29, 2026"
function formatDateStrReadable(dateStr, options = { month: 'long', day: 'numeric', year: 'numeric' }) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', options);
}

// Helper to check if a request status qualifies for "Process Document" on the calendar
export function isForProcessingStatus(status, rawStatus = '', paymentStatus = '') {
  const s = String(status || '').trim().toUpperCase();
  const rawS = String(rawStatus || '').trim().toUpperCase();
  const pStatus = String(paymentStatus || '').trim().toUpperCase();

  // If status is Pending or For Payment or On Hold, it is NOT for processing!
  if (
    s === 'PENDING' ||
    s === 'RECEIVED' ||
    s === 'REQUEST SUBMITTED' ||
    s === 'PENDING PAYMENT' ||
    s === 'PENDING_PAYMENT' ||
    s === 'PAYMENT_PENDING' ||
    s === 'PAYMENT PENDING' ||
    s === 'FOR PAYMENT' ||
    s === 'FOR_PAYMENT' ||
    s === 'CLEARED FOR PAYMENT' ||
    s === 'ON HOLD' ||
    s === 'ON_HOLD' ||
    s === 'HOLD' ||
    s === 'CANCELLED' ||
    s === 'REJECTED' ||
    rawS === 'PENDING' ||
    rawS === 'PAYMENT_PENDING' ||
    rawS === 'PENDING_PAYMENT' ||
    rawS === 'FOR_PAYMENT'
  ) {
    if (pStatus !== 'VERIFIED' && rawS !== 'PAYMENT_VERIFIED') {
      return false;
    }
  }

  return (
    s === 'FOR PROCESSING' ||
    s === 'FOR_PROCESSING' ||
    s === 'PROCESSING' ||
    s === 'DOCUMENT PREPARATION' ||
    s === 'DOCUMENT_PREPARATION' ||
    s === 'PAYMENT VERIFIED' ||
    s === 'PAYMENT_VERIFIED' ||
    rawS === 'FOR_PROCESSING' ||
    rawS === 'PAYMENT_VERIFIED' ||
    pStatus === 'VERIFIED' ||
    s === 'FOR RELEASE' ||
    s === 'FOR_RELEASE' ||
    s === 'RELEASING' ||
    s === 'READY_FOR_RELEASE' ||
    s === 'READY FOR RELEASE' ||
    s === 'READY_FOR_PICKUP' ||
    s === 'READY FOR PICKUP' ||
    s === 'CLAIMED' ||
    s === 'RELEASED'
  );
}

/**
 * Reusable ProcessCalendarCard Component
 * Displays the full month processing calendar with batch scheduling and active batches list
 * matching the RegQuest design specifications.
 */
export default function ProcessCalendarCard({
  requests = [],
  selectedDate = null,
  onDateClick = () => {},
  showActiveBatches = true,
  className = '',
}) {
  const [activeDate, setActiveDate] = useState(() => new Date());

  // 1. Group requests into batches by request_date and compute daily processing schedule
  const batchSchedule = useMemo(() => {
    const batchesByDate = {};
    requests.forEach((r) => {
      const dateKey = toLocalDateStr(r.request_date || r.created_at);
      if (!dateKey) return;
      if (!batchesByDate[dateKey]) {
        batchesByDate[dateKey] = [];
      }
      batchesByDate[dateKey].push(r);
    });

    const newRequestsCountMap = {}; // dateStr -> number of new requests submitted
    const newRequestsMap = {};      // dateStr -> array of new requests submitted
    const dailyProcessingMap = {};  // dateStr -> number of requests scheduled to process
    const dailyProcessingRequestsMap = {}; // dateStr -> array of requests specifically scheduled for this day
    const releaseBatchesMap = {};   // dateStr -> array of batch release objects
    const allBatchesList = [];      // Array of all active batch summaries for bottom section

    Object.entries(batchesByDate).forEach(([reqDate, reqs]) => {
      const totalInBatch = reqs.length;
      newRequestsCountMap[reqDate] = (newRequestsCountMap[reqDate] || 0) + totalInBatch;
      if (!newRequestsMap[reqDate]) newRequestsMap[reqDate] = [];
      newRequestsMap[reqDate].push(...reqs);

      // ONLY requests that have reached 'For Processing' (or beyond) reflect in the Process Document schedule!
      const processingReqs = reqs.filter((r) =>
        isForProcessingStatus(r.status, r.rawStatus || r.raw?.status, r.payment_status)
      );
      const totalProcessingInBatch = processingReqs.length;

      // Determine batch expected release date
      const firstWithRelDate = reqs.find((r) => r.release_date && r.release_date > reqDate);
      const releaseDate = firstWithRelDate ? firstWithRelDate.release_date : addDaysToDateStr(reqDate, 5);

      // Processing days are the days strictly between reqDate and releaseDate
      const diffDays = getDaysBetween(reqDate, releaseDate);
      const numProcessingDays = Math.max(1, diffDays - 1);

      // Divide ONLY the for-processing requests across scheduled processing days
      if (totalProcessingInBatch > 0) {
        const baseQuota = Math.floor(totalProcessingInBatch / numProcessingDays);
        const remainder = totalProcessingInBatch % numProcessingDays;

        let startIndex = 0;
        for (let i = 0; i < numProcessingDays; i++) {
          const procDate = addDaysToDateStr(reqDate, i + 1);
          const dailyQuota = baseQuota + (i < remainder ? 1 : 0);
          const slice = processingReqs.slice(startIndex, startIndex + dailyQuota);
          startIndex += dailyQuota;

          if (dailyQuota > 0) {
            dailyProcessingMap[procDate] = (dailyProcessingMap[procDate] || 0) + dailyQuota;
            if (!dailyProcessingRequestsMap[procDate]) {
              dailyProcessingRequestsMap[procDate] = [];
            }
            dailyProcessingRequestsMap[procDate].push(...slice);
          }
        }
      }

      // Count processed requests in this batch (status 'For Release', 'Claimed', or 'Released')
      const processedCount = processingReqs.filter((r) => {
        const s = (r.status || '').toLowerCase();
        return s.includes('release') || s.includes('pickup') || s.includes('ready') || s.includes('claim');
      }).length;

      const completionPercentage = totalProcessingInBatch > 0
        ? Math.round((processedCount / totalProcessingInBatch) * 100)
        : 100;

      const batchObj = {
        batchId: `batch-${reqDate}`,
        requestDate: reqDate,
        requestDateFormatted: formatDateStrReadable(reqDate),
        releaseDate,
        releaseDateFormatted: formatDateStrReadable(releaseDate),
        totalRequests: totalInBatch,
        processingRequestsCount: totalProcessingInBatch,
        processedCount,
        completionPercentage,
        requests: processingReqs,
        allBatchRequests: reqs,
      };

      if (!releaseBatchesMap[releaseDate]) {
        releaseBatchesMap[releaseDate] = [];
      }
      releaseBatchesMap[releaseDate].push(batchObj);
      allBatchesList.push(batchObj);
    });

    // Sort batches by request date descending
    allBatchesList.sort((a, b) => b.requestDate.localeCompare(a.requestDate));

    return {
      newRequestsCountMap,
      newRequestsMap,
      dailyProcessingMap,
      dailyProcessingRequestsMap,
      releaseBatchesMap,
      allBatchesList,
    };
  }, [requests]);

  // 2. Full Month Calendar Calculation
  const calendarData = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const today = new Date();

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sun
    const startGridDate = new Date(firstOfMonth);
    startGridDate.setDate(firstOfMonth.getDate() - startOffset);

    // Month header labels
    const monthTitle = activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const fullDateSubtitle = activeDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // 5 or 6 weeks grid
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const week = [];
      let weekHasCurrentMonthDays = false;

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const day = new Date(startGridDate);
        day.setDate(startGridDate.getDate() + (w * 7 + dIdx));

        const dateStr = formatLocalDateToStr(day);
        const isCurrentMonth = day.getMonth() === month;
        if (isCurrentMonth) weekHasCurrentMonthDays = true;

        const newReqs = batchSchedule.newRequestsCountMap[dateStr] || 0;
        const proc = batchSchedule.dailyProcessingMap[dateStr] || 0;
        const releasingBatches = batchSchedule.releaseBatchesMap[dateStr] || [];
        const isReleaseDate = releasingBatches.length > 0;
        const releases = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);

        let comp = null;
        let relTargetStr = '';
        if (isReleaseDate) {
          const totalReqs = releasingBatches.reduce((sum, b) => sum + b.totalRequests, 0);
          const totalProc = releasingBatches.reduce((sum, b) => sum + b.processedCount, 0);
          comp = totalReqs > 0 ? Math.round((totalProc / totalReqs) * 100) : 100;

          // Format batch origin date for banner
          const originDateStr = releasingBatches[0].requestDate;
          relTargetStr = formatDateStrReadable(originDateStr, { month: 'long', day: 'numeric', year: 'numeric' });
        }

        const hasActiveWork = newReqs > 0 || proc > 0 || isReleaseDate;

        // Build exact lists of requests for each category on this date
        const toProcessList = batchSchedule.dailyProcessingRequestsMap[dateStr] || [];
        const releasingList = (releasingBatches || []).flatMap((b) => b.requests || []);
        const newRequestsList = batchSchedule.newRequestsMap[dateStr] || [];

        week.push({
          dayNumber: day.getDate(),
          dateStr,
          isCurrentMonth,
          isToday: day.toDateString() === today.toDateString(),
          hasActiveWork,
          isReleaseDate,
          relTargetStr,
          newReqs,
          proc,
          releases,
          comp,
          toProcessList,
          releasingList,
          newRequestsList,
        });
      }

      // If week 6 has no days in the current month, omit it
      if (w < 5 || weekHasCurrentMonthDays) {
        weeks.push(week);
      }
    }

    return {
      monthTitle,
      fullDateSubtitle,
      weeks,
    };
  }, [activeDate, batchSchedule]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setActiveDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setActiveDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleToday = () => {
    setActiveDate(new Date());
  };

  const handleSelectDay = (d, preferredTab) => {
    const toProc = d.toProcessList || [];
    const rel = d.releasingList || [];
    const newR = d.newRequestsList || [];

    let activeTab = preferredTab;
    if (!activeTab) {
      if (toProc.length > 0) activeTab = 'toProcess';
      else if (rel.length > 0) activeTab = 'releasing';
      else if (newR.length > 0) activeTab = 'newRequests';
      else activeTab = 'toProcess';
    }

    onDateClick(
      d.dateStr,
      {
        toProcess: toProc,
        releasing: rel,
        newRequests: newR,
      },
      {
        proc: d.proc,
        newReqs: d.newReqs,
        releases: d.releases,
        isReleaseDate: d.isReleaseDate,
        relTargetStr: d.relTargetStr,
        preferredTab: activeTab,
      }
    );
  };

  return (
    <div className={`process-calendar-wrapper ${className}`}>
      {/* 1. Main Process Calendar Container matching the reference design */}
      <div className="process-calendar-container">
        {/* Header: Blue calendar square icon, current date subtitle, month title, and navigation */}
        <div className="calendar-header">
          <div className="calendar-header-left">
            {/* Blue Square Calendar Icon */}
            <div className="calendar-icon-box">
              <svg className="calendar-icon-svg" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                <circle cx="8" cy="14" r="1" fill="currentColor" />
                <circle cx="12" cy="14" r="1" fill="currentColor" />
                <circle cx="16" cy="14" r="1" fill="currentColor" />
                <circle cx="8" cy="18" r="1" fill="currentColor" />
                <circle cx="12" cy="18" r="1" fill="currentColor" />
                <circle cx="16" cy="18" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="calendar-title-group">
              <p className="calendar-date-subtitle">
                {calendarData.fullDateSubtitle}
              </p>
              <h2 className="calendar-month-title">
                {calendarData.monthTitle}
              </h2>
            </div>
          </div>

          {/* Navigation Controls: Previous Month, Today, Next Month */}
          <div className="calendar-nav-controls">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="calendar-nav-btn"
              title="Previous Month"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="calendar-today-btn"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="calendar-nav-btn"
              title="Next Month"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Calendar Grid */}
        <div className="calendar-grid-card">
          {/* Header Row: Periwinkle blue with deep navy column labels */}
          <div className="calendar-weekdays-row">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
              <div
                key={day}
                className="calendar-weekday-col"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="calendar-weeks-body">
            {calendarData.weeks.map((week, wIdx) => (
              <div key={`week-${wIdx}`} className="calendar-week-row">
                {week.map((d) => {
                  const isSelected = selectedDate === d.dateStr;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => handleSelectDay(d)}
                      className={`calendar-day-cell ${
                        isSelected
                          ? 'is-selected'
                          : d.isToday
                          ? 'is-today'
                          : d.isCurrentMonth
                          ? ''
                          : 'is-outside'
                      }`}
                    >
                      {/* Top Row: Day Number & Expected Release Completion Percentage */}
                      <div className="day-cell-header">
                        <span
                          className={`day-cell-number ${
                            !d.isCurrentMonth
                              ? 'outside'
                              : isSelected
                              ? 'selected'
                              : d.isToday
                              ? 'today'
                              : ''
                          }`}
                        >
                          {d.dayNumber}
                        </span>

                        {/* Completion Percentage Badge: ONLY displayed on Expected Release Date */}
                        {d.isReleaseDate && d.comp !== null && (
                          <span
                            className={`day-completion-badge ${
                              d.comp >= 100 ? 'badge-green' : 'badge-amber'
                            }`}
                          >
                            {d.comp}%
                          </span>
                        )}
                      </div>

                      {/* Middle Area: Batch Process Pills */}
                      {d.hasActiveWork && (
                        <div className="day-cell-pills">
                          {/* 1. Release Documents From Banner (Reserved for release date) */}
                          {d.isReleaseDate && (
                            <div
                              className="day-pill pill-release"
                              title={`Release documents from: ${d.relTargetStr}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectDay(d, 'releasing');
                              }}
                            >
                              Release documents from: {d.relTargetStr}
                            </div>
                          )}

                          {/* 2. Process Document Quota (Divided across processing days) */}
                          {d.proc > 0 && (
                            <div
                              className="day-pill pill-process"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectDay(d, 'toProcess');
                              }}
                            >
                              <span>Process document:</span>
                              <strong className="pill-value">{d.proc}</strong>
                            </div>
                          )}

                          {/* 3. New Requests Received (On request submission dates) */}
                          {d.newReqs > 0 && (
                            <div
                              className="day-pill pill-requests"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectDay(d, 'newRequests');
                              }}
                            >
                              <span>New requests:</span>
                              <strong className="pill-value">{d.newReqs}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bottom Indicator Line: Bright green/amber bar visible on Release Date */}
                      {d.isReleaseDate && d.comp !== null ? (
                        <div className="day-progress-bar-wrap">
                          <div
                            className={d.comp >= 100 ? 'day-progress-bar-green' : 'day-progress-bar-amber'}
                          />
                        </div>
                      ) : (
                        <div className="day-progress-placeholder" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. All Active Batches Section matching reference design */}
      {showActiveBatches && (
        <div className="active-batches-card">
          <h3 className="active-batches-title">
            All Active Batches
          </h3>

          {batchSchedule.allBatchesList.length > 0 ? (
            <div className="active-batches-list">
              {batchSchedule.allBatchesList.map((batch) => (
                <div
                  key={batch.batchId}
                  onClick={() =>
                    onDateClick(
                      batch.requestDate,
                      {
                        toProcess: batch.requests || [],
                        releasing: (batch.allBatchRequests || []).filter((r) => {
                          const s = String(r.status || '').toLowerCase();
                          return s.includes('release') || s.includes('pickup') || s.includes('ready') || s.includes('claim');
                        }),
                        newRequests: batch.allBatchRequests || batch.requests || [],
                      },
                      {
                        isBatch: true,
                        batch,
                        preferredTab: 'toProcess',
                      }
                    )
                  }
                  className="batch-item-card"
                >
                  <div>
                    <h4 className="batch-item-title">
                      {batch.requestDateFormatted} Requests
                    </h4>
                    <p className="batch-item-subtitle">
                      Releases: {batch.releaseDateFormatted}
                    </p>
                  </div>
                  <div className="batch-item-stats">
                    <span className="batch-item-ratio">
                      {batch.processedCount} / {batch.totalRequests}
                    </span>
                    <p className="batch-item-percentage">
                      {batch.completionPercentage}% Complete
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="batch-empty-state">
              No active request batches currently in progress.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
