import React from 'react';
import ustpBuilding from '../../assets/USTP.png';
import PredictedInsightCard from '../../components/admin/PredictedInsightCard';
import RequestVolumeCard from '../../components/admin/RequestVolumeCard';
import UserTable from '../../components/admin/UserTable';
import useDashboardData from '../../hooks/useDashboardData';
import '../../styles/admin/AdminDashboard.css';

export default function AdminDashboard() {
  const {
    loading,
    statusDistribution,
    staffMetrics,
    dailyVolume,
    monthlyVolume,
  } = useDashboardData();

  return (
    <div className="admin-dashboard-wrapper">
      {/* Top Banner with USTP Building & Gradient Overlay directly inlined */}
      <div className="admin-banner">
        {/* USTP Building architectural overlay on the right */}
        <div className="admin-banner-overlay">
          <img
            src={ustpBuilding}
            alt="USTP Architecture"
            className="admin-banner-img"
          />
          {/* Soft fading gradient over the image */}
          <div className="admin-banner-fade" />
        </div>

        {/* Banner Text Content */}
        <div className="admin-banner-content">
          <h1 className="admin-banner-title">
            Registrar Admin <span className="admin-banner-title-highlight">Dashboard</span>
          </h1>
          <p className="admin-banner-subtitle">
            System Analytics &amp; User Management
          </p>
        </div>
      </div>

      {/* Main Dashboard Content Stream */}
      <div className="admin-dashboard-content">
        {/* Section 1: Predicted Insight this week */}
        <PredictedInsightCard />

        {/* Section 2: Request Logs & Reports */}
        <section id="reports" className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              Request Logs &amp; Reports
            </h2>
            <p className="admin-section-subtitle">
              Transaction logs and historical analysis
            </p>
          </div>

          <div className="admin-reports-grid">
            {/* Status Distribution Card directly inlined */}
            <div className="admin-card">
              <div>
                {/* Header with Activity / Pulse Icon */}
                <div className="admin-card-header">
                  <svg className="admin-card-header-icon" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h3 className="admin-card-title">
                    Status Distribution
                  </h3>
                </div>

                {/* Loading State */}
                {loading ? (
                  <div className="space-y-4 py-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div className="h-3.5 admin-skeleton-pulse w-32" />
                          <div className="h-3 admin-skeleton-pulse w-14" />
                        </div>
                        <div className="h-2 admin-skeleton-pulse w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : statusDistribution.length === 0 ? (
                  <div className="admin-card-empty">
                    No status distribution records available.
                  </div>
                ) : (
                  /* Dynamic Status Distribution Bars */
                  <div className="status-dist-list">
                    {statusDistribution.map((item) => (
                      <div key={item.label} className="status-dist-item">
                        <div className="status-dist-info">
                          <span>{item.label}</span>
                          <span className="status-dist-meta">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="status-dist-track">
                          <div
                            className="status-dist-fill"
                            style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Staff Performance Metrics Card directly inlined */}
            <div className="admin-card">
              <div>
                {/* Header */}
                <div className="admin-card-header-stacked">
                  <h3 className="admin-card-title">
                    Staff Performance Metrics
                  </h3>
                  <p className="admin-card-subtitle">
                    Productivity analysis
                  </p>
                </div>

                {/* Loading State */}
                {loading ? (
                  <div className="space-y-3 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="admin-skeleton-row">
                        <div className="h-4 admin-skeleton-pulse w-28" />
                        <div className="h-4 admin-skeleton-pulse w-10" />
                        <div className="h-4 admin-skeleton-pulse w-10" />
                        <div className="h-4 admin-skeleton-pulse w-16" />
                      </div>
                    ))}
                  </div>
                ) : staffMetrics.length === 0 ? (
                  <div className="admin-card-empty">
                    No active staff performance metrics found.
                  </div>
                ) : (
                  /* Dynamic Metrics Table */
                  <div className="staff-table-scroll">
                    <table className="staff-table">
                      <thead>
                        <tr className="staff-table-head-row">
                          <th className="staff-table-th left">Staff Members</th>
                          <th className="staff-table-th center">Completed</th>
                          <th className="staff-table-th center">Pending</th>
                          <th className="staff-table-th right">Avg. Time</th>
                        </tr>
                      </thead>
                      <tbody className="staff-table-tbody">
                        {staffMetrics.map((staff) => (
                          <tr key={staff.name} className="staff-table-row">
                            <td className="staff-table-name">
                              {staff.name}
                            </td>
                            <td className="staff-table-completed">
                              {staff.completed}
                            </td>
                            <td className="staff-table-pending">
                              {staff.pending}
                            </td>
                            <td className="staff-table-avg">
                              {staff.avgTime || '2.1 days'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Request Volume */}
        <section id="volume">
          <RequestVolumeCard
            dailyData={dailyVolume}
            monthlyData={monthlyVolume}
            loading={loading}
          />
        </section>

        {/* Section 4: User Role Management */}
        <section id="users">
          <UserTable />
        </section>
      </div>
    </div>
  );
}
