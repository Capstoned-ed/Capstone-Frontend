import React, { useState } from 'react';

export default function StaffRequestsTable({
  loading,
  error,
  filteredRequests = [],
  totalRequestsCount = 0,
  getStatusBadge,
  onOpenProcess,
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRequests = showAll ? filteredRequests : filteredRequests.slice(0, 10);

  return (
    <div className="staff-list-card">
      <div className="staff-list-header">
        <h3 className="staff-list-title">Requests</h3>
        <p className="staff-list-subtitle">Latest document requests from students</p>
      </div>

      <div className="table-responsive">
        <table className="staff-data-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Student</th>
              <th>Document Type</th>
              <th>Status</th>
              <th>Request Date</th>
              <th>Release Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  Loading requests from server...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-rose-500">
                  {error}
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  {totalRequestsCount === 0
                    ? 'No requests assigned to you yet.'
                    : 'No requests found matching your filter criteria.'}
                </td>
              </tr>
            ) : (
              visibleRequests.map((item) => (
                <tr key={item.rawId || item.id}>
                  <td className="staff-req-id">{item.id}</td>
                  <td>
                    <div className="staff-student-name">{item.student_name}</div>
                    <div className="staff-student-sub">{item.student_id}</div>
                  </td>
                  <td>
                    <div className="staff-doc-name">{item.document_type}</div>
                    <div className="staff-doc-sub">{item.copies}</div>
                  </td>
                  <td>{getStatusBadge ? getStatusBadge(item.status) : item.status}</td>
                  <td className="staff-date-text">{item.request_date}</td>
                  <td className="staff-date-text">{item.release_date}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onOpenProcess(item)}
                      className="staff-btn-view"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && filteredRequests.length > 10 && (
        <div className="table-see-more-wrap">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="table-see-more-btn"
          >
            <span>
              {showAll ? 'See Less' : 'See More'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
