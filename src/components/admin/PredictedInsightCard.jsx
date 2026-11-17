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
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'heavy':
        return 'bg-[#FEC956]/25 text-amber-900 border-[#FEC956]/70';
      case 'very heavy':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'moderate':
      default:
        return 'bg-[#00007F]/8 text-[#00007F] border-[#00007F]/20';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 border-l-4 border-l-[#00007F] shadow-sm">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00007F]/10 text-[#00007F] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L4.2 13.9M12 15v6m-4-3h8" />
            </svg>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Predicted Insight this week
          </h2>
        </div>

        {/* Live & Workload Status Pills */}
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 animate-pulse">
              Forecasting...
            </span>
          ) : (
            <>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FEC956]/25 text-amber-900 border border-[#FEC956]/70"
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
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-[#00007F] border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
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
      <div className="bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/80 text-slate-700">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 rounded-md w-4/5" />
            <div className="h-4 bg-slate-200 rounded-md w-3/4" />
            <div className="h-4 bg-slate-200 rounded-md w-2/3" />
          </div>
        ) : (
          <div>
            <ul className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00007F] mt-2 flex-shrink-0" />
                <span>
                  Daily request forecast: expected average of <span className="font-bold text-slate-900">~{dailyAvg} requests/day</span> (Next operating day: <span className="font-bold text-slate-900">{nextDayName}</span> with <span className="font-bold text-slate-900">~{Math.round(nextDayRequests)} requests</span>)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00007F] mt-2 flex-shrink-0" />
                <span>
                  Request volume is expected to peak on <span className="font-bold text-slate-900">{peakDayName}</span> with approximately <span className="font-bold text-slate-900">{Math.round(peakRequests)} requests</span> (~{Math.round(weeklyTotal)} total this week)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00007F] mt-2 flex-shrink-0" />
                <span>
                  Monthly workload forecasted as <span className="font-bold text-slate-900">{workloadTier}</span> (~{Math.round(monthlyTotal)} requests across {operatingDays} operating days)
                </span>
              </li>
            </ul>

            {/* 5-Day Daily Outlook Chips */}
            {forecastList && forecastList.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">5-Day Outlook:</span>
                {forecastList.slice(0, 5).map((item, idx) => {
                  const isPeak = item.weekday === peakDayName;
                  return (
                    <div
                      key={idx}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs border ${
                        isPeak
                          ? 'bg-[#FEC956]/20 border-[#FEC956]/80 text-slate-900'
                          : 'bg-white border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <span className="font-bold text-[#00007F]">{item.weekday.slice(0, 3)}:</span>
                      <span className="font-semibold text-slate-900">~{Math.round(item.predicted_requests)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Subtle Fallback Notice */}
            {!isLive && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/70 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Displaying historical registrar averages while predictive service connects.</span>
                <button
                  type="button"
                  onClick={() => fetchInsights(true)}
                  disabled={refreshing}
                  className="font-semibold text-[#00007F] underline hover:text-[#0B0B36] cursor-pointer ml-2"
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
