export const ROUTES = {
  LOGIN: '/login',
  STUDENT: {
    DASHBOARD: '/student/dashboard',
    CLEARANCE: '/student/clearance',
    REQUESTS: '/student/requests',
    NEW_REQUEST: '/student/requests/new',
    CREDENTIALS: '/student/credentials',
  },
  STAFF: {
    DASHBOARD: '/staff/dashboard',
    VERIFICATION: '/staff/verification',
    CLEARANCES: '/staff/clearances',
    PAYMENTS: '/staff/payments',
    RELEASE: '/staff/release',
  },
  REGISTRAR: {
    DASHBOARD: '/registrar/dashboard',
    PROCESSING: '/registrar/processing',
    CREDENTIALS: '/registrar/credentials',
  },
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    CREDENTIALS: '/admin/credentials',
  },
  NOTIFICATIONS: '/notifications',
  FORBIDDEN: '/403',
  NOT_FOUND: '/404',
};
