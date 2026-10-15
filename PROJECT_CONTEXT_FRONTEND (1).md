# FRONTEND SYSTEM INSTRUCTIONS: AI CONTEXT & RULES

**Objective**: This document serves as the ultimate governance authority for Frontend Developers and AI agents implementing the Credential Request System frontend. It contains strict architectural, workflow, RBAC, project structure, and integration governance rules. All frontend developers and AI agents **MUST** read and adhere to these guidelines before implementing any frontend chunk.

This document is derived from the approved backend architecture and business rules verified against the implemented codebase. It does NOT alter, extend, or contradict any approved backend decision.

> **For all endpoint definitions, request payloads, response schemas, field names, filtering rules, pagination contracts, and error formats — refer exclusively to `API_REFERENCE.md`.**

---

## TABLE OF CONTENTS

1. [Source of Truth Hierarchy](#1-source-of-truth-hierarchy)
2. [Frontend Architecture Principles](#2-frontend-architecture-principles)
3. [Recommended Project Structure](#3-recommended-project-structure)
4. [Shared Constants Requirement](#4-shared-constants-requirement)
5. [Identity & Security](#5-identity--security)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Frontend RBAC Implementation Rules](#7-frontend-rbac-implementation-rules)
8. [Workflow Rendering Rules](#8-workflow-rendering-rules)
9. [API Integration Rules](#9-api-integration-rules)
10. [Pagination Governance](#10-pagination-governance)
11. [State Management Rules](#11-state-management-rules)
12. [File Upload Requirements](#12-file-upload-requirements)
13. [Notification UI Requirements](#13-notification-ui-requirements)
14. [Realtime Feature Governance](#14-realtime-feature-governance)
15. [Student Clearance Verification — Chunk 16.5](#15-student-clearance-verification--chunk-165)
16. [Official Chunk Registry](#16-official-chunk-registry)
17. [Chunk Governance Rules (Anti-Drift)](#17-chunk-governance-rules-anti-drift)
18. [Mandatory Chunk Verification](#18-mandatory-chunk-verification)
19. [Pre-Implementation Checklist](#19-pre-implementation-checklist)
20. [Frontend Definition of Done](#20-frontend-definition-of-done)
21. [Design Standards](#21-design-standards)
22. [Environment & Configuration](#22-environment--configuration)
23. [CI/CD Standards](#23-cicd-standards)

---

## 1. SOURCE OF TRUTH HIERARCHY

When any conflict exists between documentation sources, the following priority order is absolute:

| Priority | Document | Scope |
|---|---|---|
| **1 (Highest)** | `API_REFERENCE.md` | Backend API contract: endpoints, fields, schemas, errors, transitions, permissions |
| **2** | `PROJECT_CONTEXT_FRONTEND.md` | Frontend governance: architecture, RBAC UI rules, workflow rendering, chunk governance |
| **3 (Lowest)** | `FRONTEND_BACKLOG.md` | Per-chunk implementation prompts and component guidance |

**Rules:**

- The backend API contract (`API_REFERENCE.md`) is always the ultimate source of truth.
- If `PROJECT_CONTEXT_FRONTEND.md` contradicts `API_REFERENCE.md` on any backend behavior (workflow states, permissions, field names), `API_REFERENCE.md` wins.
- Frontend implementations must adapt to the backend contract. The frontend must never assume undocumented behavior.
- If `FRONTEND_BACKLOG.md` contradicts either higher-priority document, stop and escalate before implementing.

---

## 2. FRONTEND ARCHITECTURE PRINCIPLES

### 2.1 Backend Is the Source of Truth

- The backend defines all business rules, workflow states, validation logic, and permission boundaries.
- The frontend **MUST NOT** duplicate, shadow, or re-implement any business logic.
- The frontend **MUST NOT** invent workflow states, status values, field names, or transition rules that are not documented in `API_REFERENCE.md` or returned by the backend API.
- The frontend **MUST NOT** mock production data. All data must originate from live API calls.
- If a backend API does not exist for a feature, that feature **MUST NOT** be built. Log the blocker and stop.

### 2.2 No Invented Workflow States

The only valid `CredentialRequest` workflow states are:

```
PENDING
REQUIREMENTS_VERIFICATION
REQUIREMENTS_REJECTED
PAYMENT_PENDING
PAYMENT_VERIFIED
PROCESSING
READY_FOR_RELEASE
RELEASED
REJECTED
CANCELLED
```

The frontend **MUST NEVER** display, route to, or conditionally render based on any status value not in this list. These values must be imported from the shared constants file — see [Section 4](#4-shared-constants-requirement).

The valid `StudentClearance` statuses are: `PENDING`, `APPROVED`, `REJECTED`

The valid `Payment` statuses are: `PENDING`, `VERIFIED`, `REJECTED`

No status values other than those listed above may be used in any conditional rendering, routing, or display logic.

### 2.3 No Invented API Fields

Frontend developers and AI agents **MUST NOT** use field names that are not returned by the backend API. Always verify field names against `API_REFERENCE.md` before consuming them.

### 2.4 Technology Stack

- **Framework**: React with Vite
- **Routing**: `react-router-dom`
- **HTTP Client**: Axios (with interceptors for JWT injection and silent token refresh)
- **Styling**: Tailwind CSS
- **Auth Token Parsing**: `jwt-decode` (to extract `role` and `force_password_change` from the JWT payload)
- **State Management**: React Context API (for Auth) + component-level state. No external state manager (Redux, Zustand, etc.) unless explicitly approved by the project lead.
- **Build Tool**: Vite (`npm run dev` for development)
- **CI**: GitHub Actions (`frontend-ci.yml`) running `npm run lint` and `npm run build` on PRs to `main` and `dev`

---

## 3. RECOMMENDED PROJECT STRUCTURE

All frontend code must follow this directory structure. Deviations require explicit project lead approval.

```
src/
├── api/                  # Axios client instance and per-resource API call modules
├── components/
│   ├── common/           # Shared UI: Button, Modal, Badge, Toast, Table, Spinner
│   ├── requests/         # Components specific to CredentialRequest workflows
│   ├── payments/         # Components specific to OTC payment submission and verification
│   ├── clearances/       # Components for student clearance upload and review
│   └── notifications/    # NotificationBell, NotificationDropdown, NotificationItem
├── pages/
│   ├── student/          # Student-facing pages (dashboard, requests, clearance)
│   ├── staff/            # Staff-facing pages (verification, payments, release)
│   ├── registrar/        # Registrar-facing pages (processing, credentials)
│   └── admin/            # Admin-facing pages (users, credentials)
├── routes/               # Route definitions, ProtectedRoute, RoleRoute
├── hooks/                # Custom React hooks (e.g., useRequests, useNotifications)
├── context/              # React Context providers (AuthContext)
├── constants/            # Shared constants (see Section 4)
├── utils/                # Pure utility functions (date formatting, error parsing)
└── layouts/              # MainLayout, AuthLayout shell components
```

**Rules:**
- New components must be placed in the correct subdirectory. A payment component placed in `components/requests/` is a structural violation.
- Page-level components live in `pages/`. Reusable UI elements live in `components/`.
- Business-logic hooks live in `hooks/`. Utility functions with no side effects live in `utils/`.
- The `api/` directory must contain one module per backend resource (e.g., `api/requests.js`, `api/payments.js`). No raw `axios.get()` calls in page or component files.

---

## 4. SHARED CONSTANTS REQUIREMENT

Status values, role names, and route paths **MUST NEVER** be duplicated as raw strings across components. All shared constant values must be defined in the `src/constants/` directory and imported wherever needed.

### Required Constant Files

**`src/constants/workflowStatuses.js`**

Must define every valid `CredentialRequest` status and `StudentClearance` status as named exports:

```javascript
// CredentialRequest statuses
export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  REQUIREMENTS_VERIFICATION: 'REQUIREMENTS_VERIFICATION',
  REQUIREMENTS_REJECTED: 'REQUIREMENTS_REJECTED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PROCESSING: 'PROCESSING',
  READY_FOR_RELEASE: 'READY_FOR_RELEASE',
  RELEASED: 'RELEASED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

// StudentClearance statuses
export const CLEARANCE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Payment statuses
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
};
```

**`src/constants/roles.js`**

Must define all valid role values as named exports:

```javascript
export const ROLES = {
  STUDENT: 'student',
  STAFF: 'staff',
  REGISTRAR: 'registrar',
  ADMIN: 'admin',
};
```

> **Important**: JWT token role claims use lowercase values (e.g., `'student'`, `'staff'`). These values are verified against `API_REFERENCE.md` Section 3.

**`src/constants/routes.js`**

Must define all application route paths as named exports:

```javascript
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
```

**Enforcement Rule**: Any pull request containing a raw string workflow status (e.g., `=== 'PENDING'`), raw role string (e.g., `=== 'student'`), or hardcoded route path (e.g., `navigate('/student/requests')`) instead of a constant import **must be rejected** in code review.

---

## 5. IDENTITY & SECURITY

### 5.1 Authentication

- Authentication uses JWT. After a successful login, the frontend stores both the access token and the refresh token.
- The `AuthContext` parses and exposes the following claims from the JWT access token:
  - `role` — one of `student`, `staff`, `registrar`, `admin` (lowercase)
  - `force_password_change` — boolean flag
- **No separate API call** is made to retrieve user details. All identity information is extracted from the JWT payload using `jwt-decode`.
- On any `401` response, the Axios interceptor must silently attempt token refresh. If refresh fails, the interceptor clears local storage and redirects the user to `/login`.

> Refer to `API_REFERENCE.md` Section 2 for login, refresh, and logout endpoint specifications.

### 5.2 Force Password Change Flow

- After login, if `force_password_change === true` is decoded from the JWT payload, the user **MUST** be blocked from accessing any role-specific pages.
- Before Chunk 12.1 is complete: display a non-dismissible intercept screen informing the user their temporary password must be changed. Block all navigation to role-specific routes.
- The functional password-change form (with a working API call) is delivered by **Chunk 12.1** (Force Password Change Flow). Do not build the functional form before Chunk 12.1 is authorized.
- After Chunk 12.1 ships: replace the intercept screen with a functional password-change form. Refer to `API_REFERENCE.md` for the verified endpoint definition once Chunk 12.1 is implemented.
- This applies to all accounts newly provisioned by an Admin and all accounts that have been reset.

### 5.3 Token Lifecycle

- Access token lifetime: **15 minutes**
- Refresh token lifetime: **7 days**
- Refresh tokens are **rotated** on every use — the response from the refresh endpoint includes a new refresh token. The frontend must store the updated refresh token after every refresh call.
- After logout (`POST /api/auth/logout/`), clear both tokens from `localStorage` immediately.

### 5.4 Account Provisioning

- Public registration is disabled. The Admin provisions all user accounts.
- The frontend **MUST NOT** expose any public sign-up route or registration form.

---

## 6. ROLE-BASED ACCESS CONTROL (RBAC)

RBAC is defined by the backend and enforced by both the backend (hard enforcement) and the frontend (soft enforcement for UX). The frontend must never rely solely on its own RBAC checks for security — the backend always has the final say.

The four roles (values are as returned in the JWT token):

```
student
staff
registrar
admin
```

---

### 6.1 Student UI

**Allowed Pages:**
- `/student/dashboard`
- `/student/clearance` — Submit and view own clearance status
- `/student/requests` — View own request history
- `/student/requests/new` — Create a new credential request
- `/student/credentials` — Browse available credential types (read-only)
- `/notifications` — View own notifications

**Allowed Actions:**
- View own credential request history only
- Create a new credential request (only if clearance status is `APPROVED`)
- Upload clearance document (if no clearance exists, or if status is `PENDING` or `REJECTED`)
- Upload requirement documents to own requests (only while request is in `PENDING`, `REQUIREMENTS_VERIFICATION`, or `REQUIREMENTS_REJECTED`)
- Upload OTC payment receipt when own request is in `PAYMENT_PENDING`
- Cancel own request when it is in `PENDING`, `REQUIREMENTS_REJECTED`, or `PAYMENT_PENDING`
- Transition `REQUIREMENTS_REJECTED` → `PENDING` via an explicit **"Re-submit for Review"** action — requires a **separate** call to `PATCH /api/requests/{id}/transition/` with `{"status": "PENDING"}`. Uploading a document does NOT automatically change the request status.
- View and mark own notifications as read

**Hidden/Forbidden Actions:**
- Cannot access `/staff/*`, `/registrar/*`, or `/admin/*` routes
- Cannot view other students' requests, documents, clearances, or payments
- Cannot approve or reject clearances
- Cannot perform any workflow transitions other than: `PENDING` → `CANCELLED`, `REQUIREMENTS_REJECTED` → `CANCELLED`, `PAYMENT_PENDING` → `CANCELLED`, and `REQUIREMENTS_REJECTED` → `PENDING` ("Re-submit for Review")
- Cannot view Admin user management or credential type configuration pages
- Cannot cancel once the request reaches `PAYMENT_VERIFIED` or any later state
- Cannot re-submit clearance if status is `APPROVED`
- Cannot submit a new payment if a payment is already `PENDING` review for the same request

---

### 6.2 Staff UI

**Allowed Pages:**
- `/staff/dashboard`
- `/staff/verification` — View and act on the `PENDING` request queue
- `/staff/clearances` — View and review student clearance submissions
- `/staff/payments` — View and verify OTC payment receipts
- `/staff/release` — Release `READY_FOR_RELEASE` requests
- `/notifications`

> Staff may view credential types as read-only. A shared `/credentials` read-only view may be used if implemented.

**Allowed Actions:**
- View all credential requests across all students
- Transition `PENDING` → `REQUIREMENTS_VERIFICATION`
- Transition `REQUIREMENTS_VERIFICATION` → `PAYMENT_PENDING`
- Transition `REQUIREMENTS_VERIFICATION` → `REQUIREMENTS_REJECTED` (remarks required)
- Transition `REQUIREMENTS_VERIFICATION` → `REJECTED` (remarks required)
- Transition `PAYMENT_PENDING` → `REJECTED` (remarks required)
- **Transition `PAYMENT_VERIFIED` → `PROCESSING`** *(Staff is authorized per backend transition matrix)*
- Transition `READY_FOR_RELEASE` → `RELEASED`
- Review student clearances: approve or reject (remarks required on rejection)
- Verify or reject OTC payment receipts (remarks required on rejection — payment verification automatically transitions the request to `PAYMENT_VERIFIED`)
- View and mark own notifications as read

**Hidden/Forbidden Actions:**
- Cannot access `/admin/*` or `/registrar/*` routes
- Cannot create, edit, or deactivate credential types
- Cannot manage users
- Cannot transition `PROCESSING` → `READY_FOR_RELEASE` or `PROCESSING` → `REJECTED` (those are Registrar/Admin only per the backend matrix)

---

### 6.3 Registrar UI

**Allowed Pages:**
- `/registrar/dashboard`
- `/registrar/processing` — View and process `PAYMENT_VERIFIED` and `PROCESSING` requests
- `/registrar/credentials` — Manage credential types (create, edit, deactivate)
- `/notifications`

**Allowed Actions:**
- View all credential requests (broad auditing and inquiry access)
- Transition `PAYMENT_VERIFIED` → `PROCESSING`
- Transition `PROCESSING` → `READY_FOR_RELEASE`
- Transition `PROCESSING` → `REJECTED` (remarks required)
- Transition `READY_FOR_RELEASE` → `RELEASED`
- Create, edit, and deactivate credential types
- View and mark own notifications as read

**Hidden/Forbidden Actions:**
- Cannot access `/admin/*` routes
- Cannot manage users
- Cannot review student clearances (clearance review is Staff/Admin only per `StudentClearancePermission`)
- Cannot verify OTC payment receipts (payment verification is Staff/Admin only per `PaymentPermission`)
- Cannot create credential requests

---

### 6.4 Admin UI

**Allowed Pages:**
- `/admin/dashboard`
- `/admin/users` — Provision and manage all institutional users
- `/admin/credentials` — Manage credential types
- `/notifications`

**Allowed Actions:**
- Provision new users (Student, Staff, Registrar, Admin)
- Edit user roles, emails, and active status
- Deactivate (soft-delete) users
- Create, edit, and deactivate credential types
- View all credential requests
- All Staff-level workflow transitions: `PENDING` → `REQUIREMENTS_VERIFICATION`, `REQUIREMENTS_VERIFICATION` → `PAYMENT_PENDING`, `REQUIREMENTS_VERIFICATION` → `REQUIREMENTS_REJECTED` (remarks required), `REQUIREMENTS_VERIFICATION` → `REJECTED` (remarks required), `PAYMENT_PENDING` → `REJECTED` (remarks required), `PAYMENT_VERIFIED` → `PROCESSING`, `READY_FOR_RELEASE` → `RELEASED`
- All Registrar-level workflow transitions: `PROCESSING` → `READY_FOR_RELEASE`, `PROCESSING` → `REJECTED` (remarks required)
- Review and approve or reject student clearances
- Verify or reject OTC payment receipts (verification automatically transitions the request from `PAYMENT_PENDING` to `PAYMENT_VERIFIED` as a side effect)
- View and mark own notifications as read

**Note**: Admin does NOT create credential requests. Only Students can create requests.

---

## 7. FRONTEND RBAC IMPLEMENTATION RULES

- Use `ProtectedRoute` to redirect unauthenticated users to `/login`.
- Use `RoleRoute` to restrict pages to specific roles, redirecting unauthorized users to `/403`.
- The `MainLayout` sidebar/navbar **MUST** dynamically render only the navigation links that the currently authenticated user's role is authorized to see.
- Mutation buttons (Create, Edit, Delete, Approve, Reject, Transition) **MUST** be hidden (not just disabled) for roles that are not permitted to perform that action.
- Even if a button is hidden, the frontend **MUST NOT** skip backend validation. Every API call must still handle `403 Forbidden` responses gracefully.
- Role values must be imported from `src/constants/roles.js` — never compared as raw strings inline.

---

## 8. WORKFLOW RENDERING RULES

The frontend **MUST** treat each workflow status as described below. No additional statuses may be invented or rendered. All status values must be referenced from `src/constants/workflowStatuses.js`.

### 8.1 Status Display Reference

| Status | Display Label | Visual Treatment |
|---|---|---|
| `PENDING` | Pending Verification | Neutral / Gray badge |
| `REQUIREMENTS_VERIFICATION` | Under Review | Info / Blue badge |
| `REQUIREMENTS_REJECTED` | Requirements Rejected | Warning / Amber badge |
| `PAYMENT_PENDING` | Awaiting Payment | Warning / Amber badge |
| `PAYMENT_VERIFIED` | Payment Verified | Success-Light / Teal badge |
| `PROCESSING` | Processing | Info / Blue badge |
| `READY_FOR_RELEASE` | Ready for Pickup | Success / Green badge |
| `RELEASED` | Released | Muted-Success badge (terminal) |
| `REJECTED` | Rejected | Danger / Red badge (terminal) |
| `CANCELLED` | Cancelled | Muted / Gray badge (terminal) |

### 8.2 Terminal States

`RELEASED`, `REJECTED`, and `CANCELLED` are terminal states.

- No transition action buttons may be shown for requests in these states.
- The UI should clearly indicate that the request is permanently closed.
- Students **MUST NOT** be shown a cancel button once the request has reached `PAYMENT_VERIFIED` or any later state.

### 8.3 Authoritative Workflow Transition Matrix

The following table is extracted from the verified backend `CredentialRequestService.TRANSITION_MATRIX`. The frontend must use this table to determine which action buttons to show, and must never maintain its own copy of transition logic in code.

| From State | To State | Authorized Roles | Remarks Required? |
|---|---|---|---|
| `PENDING` | `REQUIREMENTS_VERIFICATION` | Staff, Admin | No |
| `PENDING` | `CANCELLED` | Student | No |
| `REQUIREMENTS_VERIFICATION` | `PAYMENT_PENDING` | Staff, Admin | No |
| `REQUIREMENTS_VERIFICATION` | `REQUIREMENTS_REJECTED` | Staff, Admin | **Yes** |
| `REQUIREMENTS_VERIFICATION` | `REJECTED` | Staff, Admin | **Yes** |
| `REQUIREMENTS_REJECTED` | `PENDING` | Student | No |
| `REQUIREMENTS_REJECTED` | `CANCELLED` | Student | No |
| `PAYMENT_PENDING` | `PAYMENT_VERIFIED` | Staff, Admin | No |
| `PAYMENT_PENDING` | `CANCELLED` | Student | No |
| `PAYMENT_PENDING` | `REJECTED` | Staff, Admin | **Yes** |
| `PAYMENT_VERIFIED` | `PROCESSING` | **Registrar, Staff, Admin** | No |
| `PROCESSING` | `READY_FOR_RELEASE` | Registrar, Admin | No |
| `PROCESSING` | `REJECTED` | Registrar, Admin | **Yes** |
| `READY_FOR_RELEASE` | `RELEASED` | **Staff, Registrar, Admin** | No |

> **Payment Verification Routing Note**: The `PAYMENT_PENDING → PAYMENT_VERIFIED` status change should always be triggered through `PATCH /api/payments/{id}/verify/` with `{"action": "VERIFY"}`, not through the generic transition endpoint. The payment verification endpoint handles this transition automatically as a side effect.

### 8.4 Mandatory Remarks

The frontend **MUST** enforce a non-empty remarks input field before any of the following transitions are submitted:

- `REQUIREMENTS_VERIFICATION` → `REQUIREMENTS_REJECTED`
- `REQUIREMENTS_VERIFICATION` → `REJECTED`
- `PAYMENT_PENDING` → `REJECTED`
- `PROCESSING` → `REJECTED`
- OTC payment receipt rejection (`action: "REJECT"` via verify endpoint)
- Student clearance rejection (`status: "REJECTED"` via review endpoint)

The frontend must **block form submission** if the remarks field is empty and display a validation message. Do not rely on the backend to enforce this first — it is a user experience requirement.

### 8.5 State Refresh Policy

After any successful transition API call or payment verification call:
- The frontend **MUST** immediately re-fetch the affected resource from the backend to refresh displayed state.
- The frontend **MUST NOT** assume the new state from what was sent — always trust the backend response.
- Optimistic state updates are **not permitted** for workflow status changes.

---

## 9. API INTEGRATION RULES

> **All endpoint paths, request body fields, response schemas, filter parameters, and error formats are defined in `API_REFERENCE.md`. Do not duplicate that information here.**

### 9.1 Endpoint Usage Rules

- The frontend **MUST** only call endpoints documented in `API_REFERENCE.md`.
- The frontend **MUST NOT** call undocumented or invented endpoints.
- All API calls must be made through the centralized `apiClient` Axios instance (with auth interceptor). Raw `axios` calls in page or component files are not permitted.
- Each backend resource must have a dedicated module in `src/api/` (e.g., `src/api/requests.js`).
- The API base URL is configured exclusively via the `VITE_API_URL` environment variable. It must never be hardcoded.

### 9.2 Error Handling Rules

- **400 Bad Request**: Display the backend validation error message directly to the user via a toast or inline form error. Do not write custom messages that obscure backend errors.
- **401 Unauthorized**: The Axios interceptor handles silent token refresh automatically. If refresh fails, redirect to `/login`.
- **403 Forbidden**: Display a user-friendly message. Do not expose technical details. Log the event for debugging.
- **404 Not Found**: Display a resource-not-found inline state (not the global `/404` page unless the route itself is invalid).
- **405 Method Not Allowed**: This indicates a bug in the frontend. Log and report it. Never surface a raw 405 to the user.
- **500 Server Error**: Display a generic error state. Do not retry automatically.
- **Multi-field 400 Errors**: Backend `400` responses may return errors for multiple fields simultaneously (e.g., `{"amount": [...], "receipt_image": [...]}`). Parse and display all field-level errors — not just the first — showing each error adjacent to its corresponding form input.

### 9.3 Backend Validation Respect

- The frontend **MUST NOT** assume a state transition succeeded unless the backend returns a `200` success response.
- The frontend **MUST NOT** optimistically update workflow state before receiving the API response.
- If the backend returns a `400` with `"You must have an APPROVED clearance to create a request."`, the UI must display this exact message and direct the student to the clearance page.

---

## 10. PAGINATION GOVERNANCE

The backend may return paginated responses for any list endpoint. Frontend code must be written to handle paginated responses correctly and must **never** assume that a list endpoint returns a raw array.

### 10.1 Paginated Response Structure

The following structure describes a paginated response (currently used only by the Notifications endpoint):

```json
{
  "count": <total items>,
  "next": "<URL or null>",
  "previous": "<URL or null>",
  "results": [...]
}
```

Refer to `API_REFERENCE.md` Section 15 for the confirmed per-endpoint pagination status.

### 10.2 Implementation Rules

- Only the **Notifications endpoint** (`GET /api/notifications/`) returns a paginated wrapper object. Read its data array from `response.data.results`.
- All other currently implemented list endpoints (requests, users, credential types, documents, clearances, payments) return a flat array directly at `response.data` — no `.results` wrapper.
- For the Notifications endpoint: use `count`, `next`, and `previous` from the response to render pagination controls where appropriate.
- Defensive coding: check `Array.isArray(response.data)` before rendering list data. If the backend introduces pagination on a previously flat endpoint in the future, this guard ensures the empty state renders gracefully instead of crashing.

> Refer to `API_REFERENCE.md` Section 15 for the exact pagination parameters (`page`, `page_size`) and per-endpoint pagination status.

---

## 11. STATE MANAGEMENT RULES

### 11.1 Server State Synchronization

- After any create, update, or delete operation, the relevant list or detail data must be re-fetched from the API.
- Cached or stale workflow state **MUST NOT** be displayed. Always prefer fresh data from the server.
- Do not persist workflow state in `localStorage` or `sessionStorage`.

### 11.2 Loading States

Every data-fetching operation **MUST** have a visible loading state. Acceptable implementations:

- Skeleton loaders for tables and detail views
- Spinner overlays for modals performing an action
- Disabled submit buttons with a loading indicator during form submissions

### 11.3 Error States

Every data-fetching and mutation operation **MUST** handle error states:

- Display a human-readable error message (using backend message when available)
- Provide a retry action where applicable
- Never silently fail — a user must always know when something went wrong

### 11.4 Empty States

Every list view **MUST** handle the empty state (zero items returned from the API):

- Display an illustrative empty state message (e.g., "No requests found")
- Do not render blank tables or empty containers without an explanation

---

## 12. FILE UPLOAD REQUIREMENTS

All file upload operations must use `multipart/form-data` encoding. When using `FormData` with Axios, do **not** manually set the `Content-Type` header — Axios sets it automatically with the correct boundary.

> Refer to `API_REFERENCE.md` Sections 7, 8, and 9 for exact endpoint paths, required fields, and backend validation error formats.

### 12.1 Universal File Constraints

The following constraints are enforced by the backend for all file uploads (clearances, requirement documents, payment receipts):

| Constraint | Value |
|---|---|
| Maximum file size | **5 MB** |
| Allowed extensions | `.pdf`, `.jpg`, `.jpeg`, `.png` |
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png` |
| MIME validation method | Magic byte inspection (not extension-only) |

The frontend **MUST** display backend file validation errors inline below the upload input field — not as a generic toast.

### 12.2 Clearance Document Upload

- **UI Component**: `ClearanceUploadForm`
- **Allowed when**: Student has no clearance, or clearance status is `PENDING` or `REJECTED`.
- **Blocked when**: Clearance status is `APPROVED` — no re-upload button should be shown.
- On success, refresh the clearance status card from the API.

### 12.3 Requirement Document Upload

- **UI Component**: Part of `RequestWizard` (Chunk 17)
- **Allowed when**: Request is in `PENDING`, `REQUIREMENTS_VERIFICATION`, or `REQUIREMENTS_REJECTED`.
- **Blocked for all other statuses**: Do not show upload controls when the request is past requirements review.
- Each document type requires its own upload field. Apply lightweight client-side pre-checks (file size, extension) as a UX convenience, but always surface backend validation errors — never suppress a backend error in favor of a passing client-side check.

### 12.4 Payment Receipt Upload (OTC Only)

- **UI Component**: `PaymentUploadForm`
- **Allowed when**: Request status is `PAYMENT_PENDING`.
- **Required fields**: `amount`, `receipt_image`, `request` (UUID). Optional: `receipt_reference_number`.
- **UX requirement**: Clearly communicate this is an **Over-The-Counter (OTC) cashier payment** — not an online gateway. Use terminology: "Upload Official Receipt", "Cashier Receipt", "Proof of OTC Payment".
- If a payment is rejected, retain the rejected record in the payment history and allow a new submission. The request remains in `PAYMENT_PENDING`.
- A new payment cannot be submitted if a `PENDING` payment already exists for the request. Display the backend error clearly.

### 12.5 File Download / Preview

- All file downloads must be performed via the backend secure download endpoints.
- The frontend **MUST NOT** construct direct file storage paths. Always use the download URL provided in the API response.
- For in-browser previewing: open the download URL in a new tab, or use an embedded PDF/image viewer component.
- Refer to `API_REFERENCE.md` Section 13 for the exact, verified download URL patterns per resource type.

---

## 13. NOTIFICATION UI REQUIREMENTS

> Refer to `API_REFERENCE.md` Section 10 for the Notification payload schema, event types, endpoint paths, and paginated response format.

### 13.1 UI Components

- **`NotificationBell`**: A bell icon in the `MainLayout` Navbar. Displays a badge with the count of unread notifications. Must be visible for all roles.
- **`NotificationDropdown`**: A popover or dropdown listing recent notifications. Each item displays:
  - The notification `message` field
  - A human-readable relative timestamp (e.g., "2 hours ago")
  - Visual read/unread distinction (e.g., bold text or colored indicator)
- **`NotificationItem`**: Individual notification row component.

### 13.2 Behavior Rules

- The unread badge count must reflect the actual count of unread notifications from the backend. Do not compute this client-side.
- Fetch notifications on component mount. Re-fetch the notification list after any successful mutation (workflow transition, clearance review, payment verification) to surface new notifications without requiring a page reload. Do not attempt to predict which specific mutations trigger notifications.
- Clicking a `NotificationItem` or a "Mark as Read" button must call the mark-as-read endpoint and update the visual state immediately. Optimistic UI is acceptable here because it does not affect workflow state.
- A "Mark All as Read" action must call the mark-all-read endpoint and clear all unread visual indicators.
- The notification list **MUST** handle: loading state, empty state ("No notifications yet"), and error state.

### 13.3 Notification Field Rules

- Frontend must only consume fields documented in `API_REFERENCE.md` Section 10.
- Frontend must **not** assume any additional fields beyond: `id`, `event_type`, `message`, `related_object_type`, `related_object_id`, `is_read`, `created_at`.
- Frontend must gracefully handle any `event_type` value it has not seen before (e.g., a future event type added to the backend). Unknown event types must not cause a crash or render error. Display a generic notification item instead.
- The `related_object_type` and `related_object_id` fields may be used to create deep links to the related resource, but this is optional and must degrade gracefully if the referenced object is not available.

---

## 14. REALTIME FEATURE GOVERNANCE

Realtime functionality is **out of scope** for the current system. The backend has not implemented any realtime infrastructure and this will only be evaluated after full system deployment and stabilization.

The following technologies are explicitly **prohibited** in the current implementation:

- WebSockets
- Django Channels
- Socket.IO
- Server-Sent Events (SSE)
- Automatic background polling (e.g., `setInterval`-based fetching without user interaction)

**Frontend developers and AI agents must rely exclusively on standard HTTP API requests.**

Notification refresh must be achieved through on-demand re-fetch triggered by user interaction or component mount. Automatic background polling is prohibited. On-demand refresh is permitted and required.

Realtime capabilities will be evaluated as a post-Chunk-25 enhancement only after the complete system is deployed and stabilized.

---

## 15. STUDENT CLEARANCE VERIFICATION — CHUNK 16.5

### Backend Status: **Complete — Frontend Implementation Authorized**

The Student Clearance backend (Chunk 16.5) has been implemented and its APIs are available. The frontend implementation of Chunk 16.5 is authorized to proceed.

**Verified backend APIs**: See `API_REFERENCE.md` Section 8 for all clearance endpoint definitions, request fields, response schemas, and file download behavior.

**Business Rule (Approved — Do Not Change):**
A student must possess an `APPROVED` StudentClearance before a `CredentialRequest` can be created. If the backend returns a `400` error with `"You must have an APPROVED clearance to create a request."`, the frontend must catch this error and display a clear, actionable message directing the student to their clearance page.

**Valid Clearance Statuses (the only valid values):**

```
PENDING    — Submitted, awaiting staff review
APPROVED   — Approved. Student may now create credential requests.
REJECTED   — Rejected. Student must re-submit.
```

These must be defined in `src/constants/workflowStatuses.js` under `CLEARANCE_STATUS`.

**Frontend Implementation Requirements**: See Section 12.2 (Clearance Document Upload) for upload UX rules, Section 6.1 (Student UI) for student-facing RBAC requirements, and Section 6.2 (Staff UI) for staff review RBAC requirements.

---

## 16. OFFICIAL CHUNK REGISTRY

This registry is the authoritative source for all chunk implementations. AI agents must never infer, reconstruct, renumber, merge, split, rename, reorder, or skip chunks.

---

### Sprint 1: DevOps & Foundation

#### Chunk 1 — Init Backend & Database
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 2 — Backend CI/CD Pipeline
Owner: DevOps Engineer
Status: **Backend Complete** — No frontend action required

#### Chunk 3 — Init Frontend & CI/CD
Owner: Frontend Developer
Status: Not Started

#### Chunk 4 — API Documentation Setup
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

---

### Sprint 2: Identity, Security & Auditing

#### Chunk 5 — Custom User Model & Role Enum
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 6 — Custom Permission Classes
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 7 — JWT Endpoints & Auth Flow
Owner: Backend Developer
Status: **Backend Complete** — Provides APIs consumed by Chunk 9

#### Chunk 8 — Foundational Audit Logging
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

---

### Sprint 3: Admin Management & Frontend Base

#### Chunk 9 — Frontend API Client & Auth Context
Owner: Frontend Developer
Status: Not Started
Dependencies: Chunk 3 (complete), Chunk 7 (complete)

#### Chunk 10 — Shared Layout System & Protected Routes
Owner: Frontend Developer
Status: Not Started
Dependencies: Chunk 9

#### Chunk 11 — Admin User Management API
Owner: Backend Developer
Status: **Backend Complete** — Provides APIs consumed by Chunk 12

#### Chunk 12 — Admin User Management UI
Owner: Full Stack Developer
Status: Not Started
Dependencies: Chunk 10 (frontend), Chunk 11 (backend complete)

#### Chunk 12.1 — Force Password Change Flow (API & UI)
Owner: Full Stack Developer
Status: Not Started
Dependencies: Chunk 9

#### Chunk 13 — Development Database Seeding
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

---

### Sprint 4: Core Domain & Credential Types

#### Chunk 14 — Credential Types API & UI
Owner: Full Stack Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 10 (frontend)

#### Chunk 15 — Request Models & State Definition
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 15.1 — Object-Level Permissions & Data Isolation
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 16 — File Uploads & Security
Owner: Backend Developer
Status: **Backend Complete** — No frontend action required

#### Chunk 16.1 — Notification Service & API
Owner: Backend Developer
Status: **Backend Complete** — Provides APIs consumed by Chunk 16.2

#### Chunk 16.2 — Frontend Notification Center
Owner: Frontend Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 10 (frontend), Chunk 16.1 (backend complete)

#### Chunk 16.5 — Student Clearance Verification
Owner: Full Stack Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 16 (complete), Chunk 16.1 (complete)

---

### Sprint 5: Student & Staff Workflows

#### Chunk 17 — Student Request API & UI
Owner: Full Stack Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 10 (frontend), Chunk 14 (backend complete), Chunk 16.5 (backend complete)

#### Chunk 18 — Workflow State Transition API
Owner: Backend Developer
Status: **Backend Complete** — Provides transition endpoints consumed by later chunks

#### Chunk 19 — Staff Verification API & UI
Owner: Frontend Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 18 (complete), Chunk 16 (complete)

#### Chunk 20 — Payment Tracking API & Integration
Owner: Full Stack Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 18 (complete), Chunk 19 (frontend)

---

### Sprint 6: Registrar Workflows & Final Transitions

#### Chunk 21 — Registrar Processing API & UI
Owner: Full Stack Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 18 (complete), Chunk 20 (frontend)

#### Chunk 22 — Release Workflow & Audit Viewing
Owner: Frontend Developer
Status: **Backend Complete — Frontend Implementation Authorized**
Dependencies: Chunk 18 (complete), Chunk 21 (frontend)

---

### Sprint 7: Testing & Production Deployment

#### Chunk 23 — End-to-End Workflow Testing
Owner: QA Engineer / Backend Developer
Status: Not Started — Frontend may need to assist with E2E test setup

#### Chunk 24 — Production Config & CORS
Owner: DevOps Engineer
Status: Not Started — No frontend action required

#### Chunk 25 — Render & Vercel Deployment Config
Owner: DevOps Engineer
Status: Not Started — Frontend CI/CD must be production-ready by this chunk

---

## 17. CHUNK GOVERNANCE RULES (ANTI-DRIFT)

**Roadmap Amendment on Record:**
Chunk 16.5 Student Clearance Verification is an approved and implemented roadmap item. It is part of the OFFICIAL CHUNK REGISTRY. AI agents must treat Chunk 16.5 as an official, backend-complete chunk and must not classify it as deferred, reserved, or unauthorized.

AI agents **MUST NEVER**:

- Renumber chunks
- Rename chunks
- Merge chunks
- Split chunks
- Reorder chunks
- Skip chunks
- Implement future chunks ahead of schedule
- Implement backend code when acting as a frontend agent
- Invent new chunks unless explicitly approved by the project lead
- Mark a chunk as deferred if it is listed as "Backend Complete" in this registry

---

## 18. MANDATORY CHUNK VERIFICATION

Before implementing ANY frontend chunk, the AI agent must display and verify the following:

```
Chunk Number:
Chunk Title:
Sprint:
Owner:
Dependencies:
Dependency Status:
Frontend Impact:
Backend APIs Available (reference API_REFERENCE.md sections):
```

Then verify:

1. The requested chunk exists in the OFFICIAL CHUNK REGISTRY.
2. The chunk title exactly matches the registry.
3. All dependencies are complete.
4. The chunk is owned by a Frontend Developer, Full Stack Developer, or QA Engineer.
5. The chunk has not already been completed.
6. Backend APIs required for this chunk are marked as available in `API_REFERENCE.md`.

If ANY verification fails:

**STOP. Do not generate code. Explain the mismatch and request clarification.**

> If the chunk status in this registry conflicts with observable reality (e.g., a frontend page already exists for a "Not Started" chunk), escalate to the project lead immediately. Do not self-correct registry statuses or chunk titles without explicit approval.

---

## 19. PRE-IMPLEMENTATION CHECKLIST

Before writing any code, output the following completed checklist:

```
Current Chunk Number:
Current Chunk Title:
Sprint:
Owner:
Dependencies:
Dependency Status:
Backend APIs Consumed (from API_REFERENCE.md):
Pages to be Created:
Components to be Created:
RBAC Roles Affected:
Constant Files Required (workflowStatuses / roles / routes):
Loading States Required:
Error States Required:
Empty States Required:
File Uploads Required:
Remarks Enforcement Required:
Pagination Handling Required:
```

Only after this checklist is completed may implementation begin.

---

## 20. FRONTEND DEFINITION OF DONE

A frontend chunk is **NOT** complete unless ALL of the following criteria are met:

1. **API Integration Completed**: All documented backend endpoints for the chunk are consumed. No hardcoded or mocked data remains.
2. **RBAC Enforced**: Pages are guarded with `ProtectedRoute` and `RoleRoute`. Mutation actions are hidden for unauthorized roles. Role comparisons use `src/constants/roles.js`.
3. **Loading States Implemented**: Every data-fetch and mutation operation shows a loading indicator.
4. **Error States Implemented**: Every API call handles errors and displays human-readable messages. Backend 400 messages are surfaced — not replaced with generic text.
5. **Empty States Implemented**: Every list view renders a meaningful empty state when zero items are returned.
6. **Responsive Layout Verified**: The page renders correctly on desktop (min 1280px), tablet (768px), and mobile (375px).
7. **No Hardcoded Constants**: Workflow status strings, role names, and route paths use constants from `src/constants/`. No raw string comparisons.
8. **No Mock Data Remaining**: All placeholder/mock data removed. Every displayed value originates from a live API call.
9. **Mandatory Remarks Enforced**: Any transition or action requiring remarks blocks submission if the remarks field is empty.
10. **Toast / Feedback Implemented**: Every successful mutation and every error state produces visible user feedback (toast or inline message).
11. **Backend Error Messages Surfaced**: Backend validation errors (400 responses) are displayed to the user — not silently swallowed.
12. **Force Password Change Guarded**: No role-specific UI is accessible before the force-password-change flow is completed.
13. **Pagination Handled**: The Notifications list component reads from `response.data.results`. All other list components read from `response.data` (flat array). Refer to `API_REFERENCE.md` Section 15 for the per-endpoint pagination contract.
14. **Project Structure Followed**: New files are placed in the correct directory per [Section 3](#3-recommended-project-structure).
15. **No Sensitive Data Logged or Exposed**: JWT tokens, passwords, and user PII must not be logged to the browser console, included in user-facing error messages, or transmitted over non-HTTPS connections in production.

---

## 21. DESIGN STANDARDS

### 21.1 Aesthetic Requirements

The frontend must deliver a **premium, modern design**. A bare minimum viable product is unacceptable. The following standards apply:

- Use **Tailwind CSS** utility classes throughout. No ad-hoc inline styles.
- Use a curated, harmonious color palette. Avoid plain red, blue, or green — prefer HSL-tuned palettes.
- Use a modern sans-serif typeface (e.g., **Inter** from Google Fonts).
- Implement **smooth transitions and micro-animations** on interactive elements (hover effects, modal open/close, button feedback).
- Use **status badges** (colored pill/badge per the status display reference in Section 8.1) for all workflow status displays.
- Use **toast notifications** for all success and error feedback on mutations.
- All modals must have smooth enter/exit transitions.

### 21.2 Responsive Design

- All pages must be responsive across desktop, tablet, and mobile breakpoints.
- Tables on mobile must collapse gracefully (card-based layout or horizontal scroll with sticky first column).

### 21.3 Accessibility

- All interactive elements must be keyboard-accessible.
- Use semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<button>`, `<form>`).
- Form inputs must have associated `<label>` elements.
- Unique, descriptive `id` attributes on all interactive elements.
- Status badges must not convey state through color alone. Always include a visible text label alongside the color indicator (labels defined in Section 8.1).
- Icon-only buttons (e.g., download, close) must have `aria-label` attributes describing their action.
- Content images must have descriptive `alt` text. Decorative images must have `alt=""`.

---

## 22. ENVIRONMENT & CONFIGURATION

- **API Base URL**: Configured via `VITE_API_URL` environment variable. Never hardcode a base URL.
- **Environment Files**: `.env.local` for local development, `.env.production` for production builds.
- **JWT Storage**: Store JWT tokens in `localStorage`. Clear all tokens on logout or on failed refresh. Note: `localStorage` was chosen for CORS compatibility with the SPA deployment model and is acceptable given the 15-minute access token lifetime and refresh token rotation. Switching to `httpOnly` cookie storage would require backend changes and is outside the frontend's scope without explicit project lead approval.
- **Logout**: Calls `POST /api/auth/logout/`, clears `localStorage`, and redirects to `/login`.
- **CORS**: The backend allows `http://localhost:3000` and `http://127.0.0.1:3000` by default. Production origins are configured via server environment variables.
- **Django Admin**: The Django admin at `/admin/` is a backend-only interface. The frontend must not link to or reference it.

---

## 23. CI/CD STANDARDS

- **Pipeline**: GitHub Actions (`frontend-ci.yml`) runs on PRs to `main` and `dev`.
- **Required checks**: `npm run lint` and `npm run build` must pass. PRs must not be merged without passing status checks.
- **Lint**: ESLint must pass with zero errors. Warnings are acceptable but should be minimized.
- **Build**: The Vite production build (`npm run build`) must complete without errors.

---

*End of Document — PROJECT_CONTEXT_FRONTEND.md*
*Version: 3.0 — Architectural review applied. All critical, recommended, and nice-to-have findings resolved.*
*This document is the authoritative governance document for all frontend implementation in the Credential Request System.*
*For API contracts, refer to `API_REFERENCE.md`. For per-chunk implementation details, refer to `FRONTEND_BACKLOG.md`.*
