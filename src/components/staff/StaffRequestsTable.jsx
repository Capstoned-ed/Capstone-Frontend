import React, { useState } from 'react';
import useToast from '../../hooks/useToast';

export default function StaffRequestsTable({
  loading,
  error,
  filteredRequests = [],
  totalRequestsCount = 0,
  getStatusBadge,
  onOpenProcess,
  title = 'Requests',
  subtitle = 'Latest document requests from students',
  badgeCount,
  emptyMessage,
  actionType = 'view', // 'view', 'claim', or 'history'
  onAction,
  onArchive,
  onRestore,
  showAssignedStaff = false,
  searchControls = null,
}) {
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const visibleRequests = showAll ? filteredRequests : filteredRequests.slice(0, 10);
  const colSpanCount = showAssignedStaff ? 8 : 7;

  const isClaimedStatus = (status) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'claimed' || s.includes('claim');
  };

  return (
    <div className="staff-list-card">
      <div className="staff-list-header flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="staff-list-title">{title}</h3>
            {badgeCount !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                {badgeCount}
              </span>
            )}
          </div>
          <p className="staff-list-subtitle">{subtitle}</p>
        </div>
      </div>

      {searchControls && (
        <div className="mb-4">
          {searchControls}
        </div>
      )}

      <div className="table-responsive">
        <table className="staff-data-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Student</th>
              <th>Document Type</th>
              <th>Status</th>
              {showAssignedStaff && <th>Assigned Staff</th>}
              <th>Request Date</th>
              <th>Release Date</th>
              <th className="text-right whitespace-nowrap min-w-[170px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpanCount} className="py-8 text-center text-sm text-slate-400">
                  Loading requests from server...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpanCount} className="py-8 text-center text-sm text-rose-500">
                  {error}
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="py-8 text-center text-sm text-slate-400">
                  {emptyMessage ||
                    (totalRequestsCount === 0
                      ? 'No requests found.'
                      : 'No requests found matching your filter criteria.')}
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
                  {showAssignedStaff && (
                    <td className="whitespace-nowrap font-medium text-slate-800 text-sm">
                      {item.assigned_staff || item.verified_by_name || item.processed_by || item.archived_by || (
                        <span className="text-slate-400 italic font-normal text-xs">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="staff-date-text">{item.request_date}</td>
                  <td className="staff-date-text">{item.release_date}</td>
                  <td className="text-right">
                    {actionType === 'claim' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const displayId = item.tracking_number || item.id || item.rawId || 'Request';
                          toast.success(`Now processing Request ${displayId}! Successfully assigned to you and ready for processing.`);
                          if (onAction) {
                            onAction(item, { skipToast: true });
                          } else if (onOpenProcess) {
                            onOpenProcess(item);
                          }
                        }}
                        className="staff-btn-process-this"
                        title="Assign to me and start processing"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span>Process This</span>
                      </button>
                    ) : actionType === 'history' ? (
                      <div className="inline-flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                        {onRestore && (
                          <button
                            type="button"
                            onClick={() => onRestore(item)}
                            className="staff-btn-restore"
                            title="Restore back to Active Processing queue"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Restore</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenProcess(item)}
                          className="staff-btn-view"
                          title="View archived request details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3" strokeWidth={2} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                        {isClaimedStatus(item.status) && onArchive && (
                          <button
                            type="button"
                            onClick={() => onArchive(item)}
                            className="staff-btn-archive"
                            title="Document claimed: Mark as Done and move to History"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Done</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenProcess(item)}
                          className="staff-btn-view"
                          title="View request details and update status"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3" strokeWidth={2} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>
                      </div>
                    )}
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
