import React, { useState, useMemo } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import NotificationItem from '../../components/notifications/NotificationItem';

export default function NotificationsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications(false);
      toast.info('Notifications refreshed');
    } catch {
      toast.error('Failed to refresh notifications');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllAsRead();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkSingleRead = async (id) => {
    try {
      await markAsRead(id);
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  // Filter notifications by Tab (All, Unread, Read)
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === 'UNREAD' && item.is_read) return false;
      if (activeTab === 'READ' && !item.is_read) return false;
      return true;
    });
  }, [notifications, activeTab]);

  const readCount = Math.max(0, notifications.length - unreadCount);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">


      {/* Main Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center flex-wrap gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0B0B36] text-amber-400 flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B0B36] tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-950 shadow-xs animate-pulse">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-2 max-w-xl leading-relaxed">
            Real-time updates regarding credential requests, clearances, payments, and system notices.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Refresh notifications list"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0B0B36] text-white hover:bg-[#181861] shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>



      {/* Filter Tabs Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 sm:p-2.5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-[#0B0B36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('UNREAD')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNREAD'
                ? 'bg-white text-[#0B0B36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('READ')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'READ'
                ? 'bg-white text-[#0B0B36] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Read ({readCount})
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="underline hover:text-rose-900 font-bold ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notifications Listing Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading && notifications.length === 0 ? (
          /* Loading Skeletons */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 animate-pulse"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-40" />
                  <div className="h-3 bg-slate-200 rounded w-full" />
                  <div className="h-2.5 bg-slate-200 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* Empty State */
          <div className="py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 font-bold shadow-inner">
              🔔
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'UNREAD'
                ? 'All caught up! 🎉'
                : activeTab === 'READ'
                ? 'No read notifications'
                : 'No notifications available'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {activeTab === 'UNREAD'
                ? 'You have acknowledged all your incoming notifications and alerts.'
                : 'When credentials are submitted, clearances are reviewed, or statuses change, alerts will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((item) => (
              <NotificationItem
                key={item.id}
                notification={item}
                onMarkRead={handleMarkSingleRead}
                showActions={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
