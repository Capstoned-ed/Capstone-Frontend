import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { ROLES } from '../../constants/roles';
import { useAuth } from '../../hooks/useAuth';

function formatEventTitle(eventType) {
  switch (eventType) {
    case 'ACCOUNT_CREATED':
      return 'Account Created';
    case 'PASSWORD_RESET':
      return 'Security Notice';
    case 'REQUEST_CREATED':
      return 'Request Submitted';
    case 'REQUEST_STATUS_CHANGED':
      return 'Status Update';
    case 'CLEARANCE_SUBMITTED':
      return 'Clearance Uploaded';
    case 'CLEARANCE_APPROVED':
      return 'Clearance Approved';
    case 'CLEARANCE_REJECTED':
      return 'Clearance Notice';
    case 'PAYMENT_SUBMITTED':
      return 'Payment Submitted';
    case 'PAYMENT_VERIFIED':
      return 'Payment Verified';
    case 'PAYMENT_REJECTED':
      return 'Payment Action Needed';
    default:
      return 'System Notification';
  }
}

function getEventBadge(eventType) {
  switch (eventType) {
    case 'CLEARANCE_APPROVED':
    case 'PAYMENT_VERIFIED':
      return {
        bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        pill: 'bg-emerald-100 text-emerald-800',
        label: 'Approved',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'CLEARANCE_REJECTED':
    case 'PAYMENT_REJECTED':
      return {
        bg: 'bg-rose-50 text-rose-600 border-rose-200',
        pill: 'bg-rose-100 text-rose-800',
        label: 'Action Needed',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    case 'REQUEST_CREATED':
    case 'REQUEST_STATUS_CHANGED':
      return {
        bg: 'bg-blue-50 text-blue-600 border-blue-200',
        pill: 'bg-blue-100 text-blue-800',
        label: 'Request',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      };
    case 'CLEARANCE_SUBMITTED':
    case 'PAYMENT_SUBMITTED':
      return {
        bg: 'bg-amber-50 text-amber-600 border-amber-200',
        pill: 'bg-amber-100 text-amber-800',
        label: 'Pending',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    default:
      return {
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        pill: 'bg-slate-100 text-slate-700',
        label: 'Notice',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      };
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDateTime(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export default function NotificationItem({
  notification,
  onMarkRead,
  showActions = true,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id, event_type, message, is_read, created_at, related_object_type, related_object_id } = notification;
  const badge = getEventBadge(event_type);
  const title = formatEventTitle(event_type);
  const timeText = formatRelativeTime(created_at);
  const fullTimeText = formatFullDateTime(created_at);

  const getActionInfo = () => {
    if (related_object_type === 'CredentialRequest') {
      if (user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR) {
        return { label: 'Process Request →', path: ROUTES.STAFF.REQUESTS };
      }
      if (user?.role === ROLES.ADMIN) {
        return { label: 'Admin Requests →', path: ROUTES.ADMIN.REQUESTS };
      }
      const trackParam = related_object_id ? `?trackId=${related_object_id}` : '';
      return { label: 'Track Request →', path: `${ROUTES.STUDENT.REQUESTS}${trackParam}` };
    }
    if (related_object_type === 'StudentClearance') {
      if (user?.role === ROLES.STAFF || user?.role === ROLES.REGISTRAR || user?.role === ROLES.ADMIN) {
        return { label: 'View Requests →', path: ROUTES.STAFF.REQUESTS };
      }
      return { label: 'Request Document →', path: ROUTES.STUDENT.NEW_REQUEST };
    }
    return null;
  };

  const actionInfo = getActionInfo();

  const handleCardClick = (e) => {
    // If clicking action buttons, do not trigger container click
    if (e.target.closest('button')) return;

    if (!is_read && onMarkRead) {
      onMarkRead(id);
    }

    if (actionInfo?.path) {
      navigate(actionInfo.path);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex items-start gap-4 p-4 sm:p-5 transition-all cursor-pointer border-b border-slate-100 last:border-none ${
        !is_read
          ? 'bg-amber-50/25 hover:bg-amber-50/50 border-l-4 border-l-amber-400'
          : 'bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent'
      }`}
    >
      {/* Event Icon Badge */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${badge.bg}`}
      >
        {badge.icon}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center flex-wrap gap-2 mb-1">
          <span
            className={`text-sm font-bold truncate ${
              !is_read ? 'text-[#0B0B36]' : 'text-slate-800'
            }`}
          >
            {title}
          </span>

          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.pill}`}>
            {badge.label}
          </span>

          {!is_read && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-400/20 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              New
            </span>
          )}
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
          {message}
        </p>

        {/* Footer Meta & Actions */}
        <div className="flex items-center flex-wrap justify-between gap-3 mt-2.5">
          <span
            className="text-[11px] text-slate-400 font-medium"
            title={fullTimeText}
          >
            🕒 {timeText} <span className="hidden sm:inline text-slate-300">({fullTimeText})</span>
          </span>

          {showActions && actionInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!is_read && onMarkRead) onMarkRead(id);
                navigate(actionInfo.path);
              }}
              className="text-xs font-bold text-[#0B0B36] hover:text-amber-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              {actionInfo.label}
            </button>
          )}
        </div>
      </div>

      {/* Mark As Read / Status Indicator */}
      <div className="absolute right-3.5 top-3.5">
        {!is_read ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(id);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            title="Mark as read"
            aria-label="Mark notification as read"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ) : (
          <span
            className="p-1 text-slate-300 inline-block"
            title="Notification read"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
