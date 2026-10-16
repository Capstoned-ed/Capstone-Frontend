import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationsApi, {
  getStoredNotifications,
  markStoredNotificationRead,
  markAllStoredNotificationsRead,
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
      if (!isAuthenticated) {
        setNotifications([]);
        return;
      }

      if (!quiet) setLoading(true);
      setError(null);
      try {
        const backendData = await notificationsApi.list();
        const localData = getStoredNotifications(user);

        // Merge and deduplicate
        const seenKeys = new Set();
        const combined = [];

        // 1. Add Backend notifications
        if (Array.isArray(backendData)) {
          backendData.forEach((item) => {
            if (item && item.id) {
              const key = `backend_${item.id}`;
              seenKeys.add(key);
              combined.push(item);
            }
          });
        }

        // 2. Add Stored/Local notifications
        localData.forEach((item) => {
          if (!item) return;
          const key = `local_${item.id}`;
          if (!seenKeys.has(key)) {
            // Check if identical message already exists from backend
            const isDuplicate = combined.some(
              (c) =>
                c.event_type === item.event_type &&
                String(c.related_object_id) === String(item.related_object_id) &&
                c.message === item.message
            );
            if (!isDuplicate) {
              seenKeys.add(key);
              combined.push(item);
            }
          }
        });

        // 3. Sort chronologically (most recent first)
        combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

  // Initial load and auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated, user?.id, user?.username, fetchNotifications]);

  // Periodic polling every 30s + sync on custom app events
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    }, 30000);

    const handleSync = () => {
      fetchNotifications(true);
    };

    window.addEventListener('regquest_requests_updated', handleSync);
    window.addEventListener('regquest_notification_created', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('regquest_requests_updated', handleSync);
      window.removeEventListener('regquest_notification_created', handleSync);
      window.removeEventListener('focus', handleSync);
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

    // If backend ID, sync with backend
    try {
      if (typeof id === 'number' || (!isNaN(id) && !String(id).startsWith('notif_'))) {
        await notificationsApi.markRead(id);
      }
    } catch (err) {
      console.warn(`Failed to mark notification #${id} as read on server:`, err);
    }
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
