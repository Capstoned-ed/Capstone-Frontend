import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationsApi, {
  getStoredNotifications,
  markStoredNotificationRead,
  markAllStoredNotificationsRead,
  notifyRealtimeUpdate,
  purgeHallucinatedNotifications,
  isNotificationForUser,
} from '../api/notifications';
import { useAuth } from '../hooks/useAuth';

export const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(
    async (quiet = false) => {
      if (!isAuthenticated || !user) {
        setNotifications([]);
        return;
      }

      if (!quiet) setLoading(true);
      setError(null);
      try {
        // Clean up any stale hallucinated mock notifications
        purgeHallucinatedNotifications();

        // 1. Fetch genuine database notifications from Django Backend
        const backendData = await notificationsApi.list();
        // 2. Fetch any real locally-saved actions strictly targeted to this user
        const localData = getStoredNotifications(user);

        const seenIds = new Set();
        const combined = [];

        // 1. Backend notifications are primary source of truth (strictly verified for user role)
        if (Array.isArray(backendData)) {
          backendData.forEach((item) => {
            if (item && item.id && isNotificationForUser(item, user)) {
              const idStr = String(item.id);
              seenIds.add(idStr);
              combined.push({
                ...item,
                id: item.id,
                is_read: Boolean(item.is_read),
              });
            }
          });
        }

        // 2. Add legitimate local notifications (strictly verified for user role)
        localData.forEach((item) => {
          if (!item || !item.id || !isNotificationForUser(item, user)) return;
          const idStr = String(item.id);
          if (seenIds.has(idStr)) return;

          // Check if identical event/message exists from backend
          const isDuplicate = combined.some(
            (c) =>
              c.event_type === item.event_type &&
              String(c.related_object_id || '') === String(item.related_object_id || '') &&
              c.message === item.message
          );

          if (!isDuplicate) {
            seenIds.add(idStr);
            combined.push(item);
          }
        });

        // 3. Sort chronologically (newest first)
        combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setNotifications(combined);
      } catch (err) {
        console.warn('Failed to load notifications:', err);
        setError('Unable to load notifications.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [isAuthenticated, user]
  );

  // Initial load and on user authentication change
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated, user?.id, user?.username, user?.role, fetchNotifications]);

  // Real-time synchronization: fast polling (4s) + cross-tab BroadcastChannel + window events
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fast polling every 4 seconds when active tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    }, 4000);

    const handleSync = () => {
      fetchNotifications(true);
    };

    // Cross-tab broadcast listener for sub-second sync across multiple windows/tabs
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('regquest_realtime_notifications');
        channel.onmessage = () => {
          fetchNotifications(true);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    };

    const handleStorageChange = (e) => {
      if (
        e.key === 'regquest_stored_notifications' ||
        e.key === 'regquest_submitted_requests' ||
        e.key?.startsWith('regquest_read_notifs_')
      ) {
        fetchNotifications(true);
      }
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_notification_created', handleSync);
    window.addEventListener('regquest_status_updated', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      if (channel) {
        channel.close();
      }
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_notification_created', handleSync);
      window.removeEventListener('regquest_status_updated', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    if (!id) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(id) ? { ...n, is_read: true } : n))
    );

    // Mark in local store
    markStoredNotificationRead(id, user);

    // Sync with backend (supports both UUIDs and numeric IDs)
    try {
      const idStr = String(id);
      if (!idStr.startsWith('notif_') && !idStr.startsWith('local_')) {
        await notificationsApi.markRead(id);
      }
    } catch (err) {
      console.warn(`Failed to mark notification #${id} as read on server:`, err);
    }

    notifyRealtimeUpdate({ reason: 'marked_read', id });
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    // Mark in local store
    markAllStoredNotificationsRead(user, notifications);

    // Sync with backend
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.warn('Failed to mark all notifications as read on server:', err);
    }

    notifyRealtimeUpdate({ reason: 'marked_all_read' });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
