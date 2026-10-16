import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import NotificationItem from './NotificationItem';
import { ROUTES } from '../../constants/routes';

export default function NotificationDropdown({
  isOpen,
  onClose,
  dropdownPositionClass = 'top-full right-0 mt-2',
}) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }

    // Capture escape key
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayList = notifications.slice(0, 6);

  const handleViewAll = () => {
    onClose();
    navigate(ROUTES.NOTIFICATIONS);
  };

  return (
    <div
      ref={dropdownRef}
      className={`absolute z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-fadeIn text-slate-800 ${dropdownPositionClass}`}
      role="region"
      aria-label="Notifications Dropdown"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#0B0B36] text-white flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight text-white">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
              {unreadCount} new
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-slate-200">
              0 unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 hover:underline transition-colors cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
        {loading && notifications.length === 0 ? (
          /* Loading Skeletons */
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-24" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : displayList.length === 0 ? (
          /* Empty State */
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
              🔔
            </div>
            <p className="text-xs font-bold text-slate-800">No Notifications</p>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] mx-auto">
              You are completely up to date! System alerts will appear here.
            </p>
          </div>
        ) : (
          displayList.map((item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              onMarkRead={markAsRead}
              onCloseDropdown={onClose}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleViewAll}
          className="text-[#0B0B36] font-bold hover:underline transition-colors cursor-pointer"
        >
          View all notifications →
        </button>
        {notifications.length > 0 && (
          <span className="text-[11px] text-slate-400">
            Showing {displayList.length} of {notifications.length}
          </span>
        )}
      </div>
    </div>
  );
}
