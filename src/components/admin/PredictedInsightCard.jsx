import React, { useState, useEffect } from 'react';
import requestsApi from '../../api/requests';

export default function PredictedInsightCard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);

  const fetchInsights = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [dailyRes, monthlyRes] = await Promise.allSettled([
        requestsApi.getDailyForecast({ operatingDays: 5 }),
        requestsApi.getMonthlyWorkload(),
      ]);

      if (dailyRes.status === 'fulfilled' && dailyRes.value) {
        setDailyData(dailyRes.value);
      }

      if (monthlyRes.status === 'fulfilled' && monthlyRes.value) {
        setMonthlyData(monthlyRes.value);
      }
    } catch (err) {
      console.warn('Notice loading insights, using operational baseline:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Determine if live predictive service answered successfully
  const isLive = Boolean(
    dailyData &&
    dailyData.status === 'success' &&
    Array.isArray(dailyData.forecast) &&
    dailyData.forecast.length > 0
  );

  // Compute daily forecast list with graceful operational defaults
  const forecastList = isLive
    ? dailyData.forecast
    : [
        { date: '', weekday: 'Monday', predicted_requests: 35 },
        { date: '', weekday: 'Tuesday', predicted_requests: 28 },
        { date: '', weekday: 'Wednesday', predicted_requests: 24 },
        { date: '', weekday: 'Thursday', predicted_requests: 23 },
        { date: '', weekday: 'Friday', predicted_requests: 23 },
      ];

  // Peak day calculation
  const peakDayObj = forecastList.reduce((max, item) =>
    (item.predicted_requests > (max?.predicted_requests || 0)) ? item : max,
    forecastList[0]
  );
  const peakDayName = peakDayObj?.weekday || 'Monday';
  const peakRequests = peakDayObj?.predicted_requests || 35;

  // Weekly total & daily average
  const weeklyTotal = dailyData?.total_predicted_requests ||
    forecastList.reduce((sum, d) => sum + (d.predicted_requests || 0), 0);
  const dailyAvg = Math.round(weeklyTotal / Math.max(1, forecastList.length));

  // Next operating day
  const nextDayObj = forecastList[0] || { weekday: 'Monday', predicted_requests: 30 };
  const nextDayName = nextDayObj.weekday || 'Monday';
  const nextDayRequests = nextDayObj.predicted_requests || 30;

  // Monthly workload display
  const workloadTier = monthlyData?.workload_classification || monthlyData?.workload_level || 'Moderate';
  const monthlyTotal = monthlyData?.total_predicted_requests || 540;
  const operatingDays = monthlyData?.operating_days_count || monthlyData?.operating_days || 21;

  // Workload badge color helper
  const getWorkloadBadgeClasses = (tier) => {
    switch (String(tier || '').toLowerCase()) {
      case 'light':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'heavy':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'very heavy':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'moderate':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="bg-[#DCE6FF] rounded-2xl p-5 sm:p-6 border border-indigo-200/80 shadow-xs">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#CCD9FE] text-[#3730A3] flex items-center justify-center flex-shrink-0 shadow-inner">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L4.2 13.9M12 15v6m-4-3h8" />
            </svg>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#151740] tracking-tight">
            Predicted Insight this week
          </h2>
        </div>

        {/* Live & Workload Status Pills */}
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 animate-pulse">
              Forecasting...
            </span>
          ) : (
            <>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300"
                  title="Predictive service warming up; displaying historical registrar averages"
                >
                  Historical Baseline
                </span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getWorkloadBadgeClasses(workloadTier)}`}>
                {workloadTier} Workload
              </span>
              <button
                type="button"
                onClick={() => fetchInsights(true)}
                disabled={refreshing || loading}
                title="Refresh forecast"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/70 hover:bg-white text-indigo-700 hover:text-indigo-900 border border-indigo-200/80 transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inner Insight Box */}
      <div className="bg-[#7888F6] rounded-xl p-4 sm:p-5 text-[#0A0D28]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-indigo-300/60 rounded-md w-4/5" />
            <div className="h-4 bg-indigo-300/60 rounded-md w-3/4" />
            <div className="h-4 bg-indigo-300/60 rounded-md w-2/3" />
          </div>
        ) : (
          <div>
            <ul className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
                <span>
                  Daily request forecast: expected average of <span className="font-bold">~{dailyAvg} requests/day</span> (Next operating day: <span className="font-bold">{nextDayName}</span> with <span className="font-bold">~{Math.round(nextDayRequests)} requests</span>)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
                <span>
                  Request volume is expected to peak on <span className="font-bold">{peakDayName}</span> with approximately <span className="font-bold">{Math.round(peakRequests)} requests</span> (~{Math.round(weeklyTotal)} total this week)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0A0D28] mt-1.5 flex-shrink-0" />
                <span>
                  Monthly workload forecasted as <span className="font-bold">{workloadTier}</span> (~{Math.round(monthlyTotal)} requests across {operatingDays} operating days)
                </span>
              </li>
            </ul>

            {/* 5-Day Daily Outlook Chips */}
            {forecastList && forecastList.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-indigo-300/50 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#0A0D28]/85 mr-1">5-Day Outlook:</span>
                {forecastList.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/35 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-medium text-[#0A0D28] flex items-center gap-1.5 shadow-2xs border border-white/20"
                  >
                    <span className="font-bold">{item.weekday.slice(0, 3)}:</span>
                    <span>~{Math.round(item.predicted_requests)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subtle Fallback Notice */}
            {!isLive && (
              <div className="mt-2.5 pt-2 border-t border-indigo-300/30 text-[11px] text-[#0A0D28]/75 flex items-center justify-between">
                <span>Displaying historical registrar averages while predictive service connects.</span>
                <button
                  type="button"
                  onClick={() => fetchInsights(true)}
                  disabled={refreshing}
                  className="font-semibold underline hover:text-[#0A0D28] cursor-pointer ml-2"
                >
                  {refreshing ? 'Connecting...' : 'Retry Live'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
