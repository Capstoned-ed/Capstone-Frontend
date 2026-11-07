export const ROUTES = {
  LOGIN: '/login',
  FORBIDDEN: '/forbidden',
  NOT_FOUND: '/404',

  STUDENT: {
    DASHBOARD: '/student/dashboard',
    CLEARANCE: '/student/clearance',
    NEW_REQUEST: '/student/new-request',
    REQUESTS: '/student/requests',
    PAYMENTS: '/student/payments',
    CREDENTIALS: '/student/credentials',
    PROFILE: '/student/profile',
  },

  STAFF: {
    DASHBOARD: '/staff/dashboard',
    CALENDAR: '/staff/calendar',
    REQUESTS: '/staff/requests',
    BATCHES: '/staff/batches',
    VERIFICATION: '/staff/verification',
    CLEARANCES: '/staff/clearances',
    RELEASE: '/staff/release',
  },

  REGISTRAR: {
    DASHBOARD: '/registrar/dashboard',
    ANALYTICS: '/registrar/analytics',
    CALENDAR: '/registrar/calendar',
    REQUESTS: '/registrar/requests',
    CREDENTIALS: '/registrar/credentials',
    PROCESSING: '/registrar/processing',
  },

  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    ANALYTICS: '/admin/analytics',
    CALENDAR: '/admin/calendar',
    USERS: '/admin/users',
  },

  NOTIFICATIONS: '/notifications',
};
