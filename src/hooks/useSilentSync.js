import { useEffect, useRef } from 'react';

/**
 * Custom hook for smart, near-real-time silent background synchronization.
 * - Polls every 12 seconds in the background.
 * - Automatically pauses polling when document is hidden (document.hidden === true).
 * - Fires an immediate silent refresh when the user returns to the tab (focus / visibilitychange).
 * - Listens for mutation events ('regquest_requests_updated', etc.).
 *
 * @param {Function} onSync - Callback receiving (silent = true)
 * @param {Object} [options]
 * @param {number} [options.intervalMs=12000] - Polling interval (default 12s)
 * @param {boolean} [options.enabled=true] - Whether sync is active
 * @param {string[]} [options.events] - Additional window events to listen to
 */
export function useSilentSync(onSync, { intervalMs = 12000, enabled = true, events = [] } = {}) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let timer = null;

    const performSync = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        return;
      }
      onSyncRef.current?.(true);
    };

    // 12-second background polling timer
    timer = setInterval(performSync, intervalMs);

    // Tab focus / visibility change handler
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        performSync();
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        performSync();
      }
    };

    const handleMutationEvent = () => {
      performSync();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('regquest_requests_updated', handleMutationEvent);
    window.addEventListener('regquest_status_updated', handleMutationEvent);
    window.addEventListener('regquest_assignments_updated', handleMutationEvent);

    events.forEach((evt) => {
      window.addEventListener(evt, handleMutationEvent);
    });

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('regquest_requests_updated', handleMutationEvent);
      window.removeEventListener('regquest_status_updated', handleMutationEvent);
      window.removeEventListener('regquest_assignments_updated', handleMutationEvent);
      events.forEach((evt) => {
        window.removeEventListener(evt, handleMutationEvent);
      });
    };
  }, [enabled, intervalMs, events]);
}

export default useSilentSync;

