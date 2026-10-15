# Frontend Development Backlog

## Chunk 3

## Init Frontend & CI/CD

Owner: Frontend Developer

Status:
* READY

Purpose:
Scaffold the React application using Vite, configure Tailwind CSS, and set up the GitHub Actions CI pipeline for linting and building.

Dependencies:
None

Available Backend APIs:
None required.

Required Pages:
- Empty layout shell

Required Components:
- Tailwind config

Acceptance Criteria:
- `npm run dev` starts the Vite server successfully.
- Tailwind utility classes are applied correctly in the browser.
- Frontend CI workflow passes on GitHub.

Implementation Notes:
Initialize the Vite app inside the `frontend/` directory of the monorepo. Use standard React templates. Ensure environment variable loading is configured (`VITE_API_URL`).

AI Prompt For Frontend Developer:
> Please implement Chunk 3: Init Frontend & CI/CD. Navigate to the `frontend/` directory, scaffold a React Vite project, install and configure Tailwind CSS, and create a GitHub Actions workflow in `.github/workflows/frontend-ci.yml` that runs `npm run lint` and `npm run build` on PRs to `main` and `dev`.

---

## Chunk 9

## Frontend API Client & Auth Context

Owner: Frontend Developer

Status:
* READY

Purpose:
Implement an Axios-based API client for the frontend and establish a global React Context for Authentication. The API client must handle attaching JWT access tokens to outgoing requests and intercepting 401 errors to attempt token refresh using the refresh token.

Dependencies:
Chunk 3 (Init Frontend & CI/CD), Chunk 7 (JWT Endpoints & Auth Flow)

Available Backend APIs:
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`

Required Pages:
- Login Page (`/login`)

Required Components:
- `AuthContext` (React Context Provider)
- `apiClient` (Axios instance with interceptors)
- LoginForm

Acceptance Criteria:
- Axios interceptor automatically attaches the `Authorization: Bearer <access_token>` header.
- On a 401 response, the interceptor transparently attempts `/api/auth/refresh/`. If refresh fails, it clears local storage and forces a redirect to `/login`.
- Login form successfully exchanges credentials for JWT tokens and stores them.
- After login, the `AuthContext` makes the user's role and `force_password_change` flag globally accessible.

Implementation Notes:
Extract the custom claims (`role`, `force_password_change`) directly from the JWT access token payload after login (use a library like `jwt-decode`). Do not make a separate API call for user details. Use the standardized API response formats as documented.

AI Prompt For Frontend Developer:
> Please implement Chunk 9: Frontend API Client & Auth Context. Create an Axios client with interceptors for JWT injection and silent refresh. Implement a React `AuthContext` that parses and exposes the `role` and `force_password_change` claims from the access token. Finally, build a basic Tailwind-styled Login Page that authenticates against `/api/auth/login/`.

---

## Chunk 10

## Shared Layout System & Protected Routes

Owner: Frontend Developer

Status:
* READY

Purpose:
Create the foundational application layout (e.g., Sidebar, Navbar) and implement routing security to ensure users can only access views permitted by their role.

Dependencies:
Chunk 9 (Frontend API Client & Auth Context)

Available Backend APIs:
None directly required.

Required Pages:
- 403 Forbidden Page
- 404 Not Found Page
- Skeleton dashboard pages for Student, Staff, Registrar, and Admin (e.g., `/student/dashboard`).

Required Components:
- `ProtectedRoute`: Wrapper component that redirects unauthenticated users to `/login`.
- `RoleRoute`: Wrapper component that restricts access to specific roles, redirecting unauthorized users to `/403`.
- `MainLayout`: The overarching shell containing the navigation elements, which dynamically render links based on the active user's role.

Acceptance Criteria:
- Attempting to access a protected route without a token redirects to `/login`.
- A Student attempting to visit `/staff/*` is immediately redirected to `/403`.
- The Sidebar/Navbar only displays links that the user's role is authorized to see.
- The UI features a premium, modern design aesthetic (Tailwind CSS).

Implementation Notes:
Leverage `react-router-dom` for routing. The `AuthContext` from Chunk 9 should dictate the rendering logic within `ProtectedRoute` and `RoleRoute`. Ensure responsive design for the layout.

AI Prompt For Frontend Developer:
> Please implement Chunk 10: Shared Layout System & Protected Routes. Using React Router, establish a `ProtectedRoute` wrapper to enforce authentication, and a `RoleRoute` wrapper to enforce RBAC using the context established in Chunk 9. Build a responsive `MainLayout` shell (Sidebar/Navbar) styled with Tailwind CSS that conditionally renders links based on the user's role. Finally, create placeholder dashboard components for each role and wire up the routing tree.

---

## Chunk 12

## Admin User Management UI

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY

Purpose:
Build the Admin dashboard interface for provisioning and managing institutional users (Students, Staff, Registrars, Admins) consuming the `/api/users/` backend CRUD endpoints.

Dependencies:
Chunk 10 (Shared Layout), Chunk 11 (Admin User Management API)

Available Backend APIs:
- `GET /api/users/` (List all users)
- `POST /api/users/` (Create user)
- `PATCH /api/users/{id}/` (Update user)
- `DELETE /api/users/{id}/` (Deactivate user)

Required Pages:
- Admin Users List Page (`/admin/users`)

Required Components:
- `UserTable`: Displays a paginated or scrollable list of users with their roles and status.
- `UserCreateModal`: Form to provision a new user (Username, Email, Password, Role).
- `UserEditModal`: Form to update a user's details (Email, Role, Status).
- `UserDeleteDialog`: Confirmation dialog before calling the DELETE endpoint for deactivation.

Acceptance Criteria:
- Admins can view a table of all registered users.
- Admins can create new users; the form must handle backend validation errors gracefully.
- Admins can edit users' roles or emails.
- Admins can deactivate users, which updates the UI immediately.
- The UI must have a premium, polished design (Tailwind CSS) with loaders and success/error toasts.

Implementation Notes:
Since the backend forces `force_password_change = True` upon creation, the frontend simply needs to send the required fields. When deleting, the backend performs a soft delete (is_active=False), so the UI should reflect the status change rather than removing the row entirely, or provide a filter for inactive users.

AI Prompt For Frontend Developer:
> Please implement the Frontend portion of Chunk 12: Admin User Management UI. Create an Admin dashboard page at `/admin/users` utilizing the `/api/users/` endpoints. Build a data table to list users, and modals for creating, updating, and deactivating (soft-deleting) users. Ensure the design is highly polished with Tailwind CSS, handles API loading states, displays success/error toasts, and reflects the `is_active` status of users.

---

## Chunk 14

## Credential Types UI

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY

Purpose:
Build the Admin/Registrar configuration interface to manage what credential documents are available for students to request, and display a Read-Only list for Students/Staff.

Dependencies:
Chunk 10 (Shared Layout), Chunk 14 (Credential Types API)

Available Backend APIs:
- `GET /api/credential-types/` (List all types)
- `POST /api/credential-types/` (Create type)
- `PATCH /api/credential-types/{id}/` (Update type)
- `DELETE /api/credential-types/{id}/` (Deactivate type)

Required Pages:
- Credential Configuration Page (`/admin/credentials` or `/registrar/credentials`)
- Student Available Credentials View (`/student/credentials`)

Required Components:
- `CredentialTypeTable`: Displays `code`, `name`, `price`, `processing_days`, and `is_active`.
- `CredentialTypeForm`: Used in a modal to create or update credential types.
- `CredentialTypeCard`: Used on the Student dashboard to display available options aesthetically.

Acceptance Criteria:
- Admins/Registrars can view, create, edit, and deactivate Credential Types via the table and form modals.
- Students and Staff only see the active Credential Types in a Read-Only format.
- Deleting a credential soft-deletes it on the backend, so the UI should filter out inactive credentials by default for Students, but show them (with a disabled badge) for Admins.
- Validation: Ensure `code` is unique and `price` is formatted as currency.

Implementation Notes:
The API uses fixed pricing and enforces role-based access. Students submitting `POST` requests will receive `403 Forbidden`. Make sure the UI hides the Create/Edit/Delete buttons entirely if the current user role is Student or Staff.

AI Prompt For Frontend Developer:
> Please implement the Frontend portion of Chunk 14: Credential Types UI. Build a configuration data table for Admins/Registrars to perform CRUD operations on `/api/credential-types/`. For Students, build a Read-Only, card-based display of available credentials. Implement RBAC in the UI so that mutation buttons are hidden for unauthorized roles. Use Tailwind CSS for a premium aesthetic, including status badges and currency formatting.

---

## Chunk 16.2

## Frontend Notification Center

Owner: Frontend Developer

Status:
* READY

Purpose:
Build a UI notification center (bell icon dropdown and/or dedicated page) to display system notifications to the authenticated user.

Dependencies:
Chunk 10 (Shared Layout), Chunk 16.1 (Notification Service & API)

Available Backend APIs:
- `GET /api/notifications/` (List all notifications for the authenticated user)
- `PATCH /api/notifications/{id}/read/` (Mark a specific notification as read)
- `POST /api/notifications/mark-all-read/` (Mark all notifications as read)

Required Pages:
- (Optional) Dedicated Notifications Full Page (e.g., `/notifications`).

Required Components:
- `NotificationBell`: A bell icon in the Navbar displaying a badge with the unread notifications count.
- `NotificationDropdown`: A popover or dropdown listing recent notifications with read/unread visual states.
- `NotificationItem`: Individual list item displaying the notification title, message, timestamp, and read status.

Acceptance Criteria:
- Unread count badge accurately reflects the number of unread notifications from the backend.
- Users can view a list of recent notifications.
- Clicking a notification or a "mark as read" button successfully updates its status via the API and removes the unread visual indicator.
- Empty states and loading states are handled gracefully.
- The UI follows premium modern design aesthetics using Tailwind CSS.

Implementation Notes:
Integrate the `NotificationBell` into the `MainLayout` created in Chunk 10. Rely on the user's Auth token for API calls. Fetch notifications on component mount.

AI Prompt For Frontend Developer:
> Please implement Chunk 16.2: Frontend Notification Center. Build a `NotificationBell` with an unread badge to place in the Navbar, and a dropdown/popover to display recent items from `/api/notifications/`. Add functionality to mark individual or all notifications as read. Ensure the design is polished with Tailwind CSS and handles API loading/empty states appropriately.

---

## Chunk 16.5

## Student Clearance Verification UI

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY

Purpose:
Build the interfaces for students to upload their clearance documents and for Staff/Admins to review and approve/reject them.

Dependencies:
Chunk 10 (Shared Layout), Chunk 16.5 (Backend Clearance API)

Available Backend APIs:
- `GET /api/clearances/` (List clearances)
- `POST /api/clearances/` (Submit a clearance file)
- `PATCH /api/clearances/{id}/review/` (Approve/Reject a clearance, requires remarks if rejected)
- `GET /api/clearances/{id}/download/` (Download the attached clearance file)

Required Pages:
- Student Clearance Dashboard (`/student/clearance`)
- Staff Clearance Review Dashboard (`/staff/clearances`)

Required Components:
- `ClearanceUploadForm`: A file upload component for students.
- `ClearanceStatusCard`: Displays the student's current status (`PENDING`, `APPROVED`, `REJECTED`) and any rejection remarks.
- `StaffClearanceTable`: A data table for staff to view all submitted clearances.
- `ClearanceReviewModal`: A modal for staff to review a clearance, preview/download the document, and submit an Approve or Reject decision (with remarks).

Acceptance Criteria:
- Students can seamlessly upload a PDF/Image for clearance.
- Staff can view a list of all clearances and filter by status.
- Staff can approve or reject a clearance. Rejecting forces the staff to input a reason/remark.
- Files are downloaded securely using the backend download endpoint.
- Polished Tailwind UI with success/error toasts and loading indicators.

AI Prompt For Frontend Developer:
> Please implement the UI for Chunk 16.5: Student Clearance Verification. Build the `/student/clearance` upload page and the `/staff/clearances` review table. Ensure Staff are forced to provide remarks when rejecting. Implement secure file downloading via the `/api/clearances/{id}/download/` endpoint and use Tailwind for a premium aesthetic.

---

## Chunk 17

## Student Request API & UI

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY (Backend APIs fully satisfied by prior chunks)

Purpose:
Build the student-facing dashboard and wizard allowing them to create a new credential request and track the status of their existing requests.

Dependencies:
Chunk 10 (Shared Layout), Chunk 14 (Credential Types), Chunk 16.5 (Clearance Verification)

Available Backend APIs:
- `GET /api/requests/` (List all requests for the student)
- `POST /api/requests/` (Create a new request)
- `GET /api/requests/{id}/` (View request details)

Required Pages:
- Student Requests Dashboard (`/student/requests`)
- Request Creation Wizard (`/student/requests/new`)

Required Components:
- `RequestHistoryTable`: Displays the student's requests, statuses, tracking numbers, and creation dates.
- `RequestWizard`: A multi-step form to create a request. Step 1: Select Credential Type. Step 2: Add Remarks. Step 3: Review and Submit.

Acceptance Criteria:
- Students can view a formatted history of their requests.
- Students can initiate a new request via the wizard.
- If the backend returns a 400 validation error (e.g., student does not have an APPROVED clearance), the UI must catch it and display a clear warning/toast instructing them to complete their clearance first.
- The UI follows a highly dynamic and premium aesthetic using Tailwind CSS.

AI Prompt For Frontend Developer:
> Please implement the Frontend portion of Chunk 17: Student Request UI. Build the student request history table and the new request creation wizard. Ensure you elegantly handle backend 400 errors (such as the clearance prerequisite failure) by showing user-friendly toasts. Design must be modern and utilize Tailwind CSS.

---

## Chunk 19: Staff Verification API & UI

Owner: Frontend Developer

Status:
* READY (Backend APIs fully satisfied by Chunk 16 and Chunk 18, nested document API added)

Purpose:
Build the staff-facing dashboard allowing them to pull requests from the `PENDING` queue, transition them to `REQUIREMENTS_VERIFICATION`, review attached documents, and ultimately approve (`PAYMENT_PENDING`) or reject (`REQUIREMENTS_REJECTED`) the request.

Dependencies:
Chunk 18 (Workflow State Transition API), Chunk 16 (File Uploads & Security)

Available Backend APIs:
- `GET /api/requests/?status=PENDING` (Fetch unverified requests)
- `GET /api/requests/{id}/` (View request details, now includes nested `documents` list with `id`, `document_type`, `file` URL, `uploaded_at`)
- `PATCH /api/requests/{id}/transition/` (Transition request status, requires `remarks` for rejections)

Required Pages:
- Staff Verification Dashboard (`/staff/verification`)

Required Components:
- `VerificationQueueTable`: Displays the queue of `PENDING` requests.
- `VerificationModal`: A workspace view where Staff can preview the student's uploaded documents (via the `file` download URL) side-by-side with transition action buttons (Verify/Reject).

Acceptance Criteria:
- Staff can see a list of requests awaiting verification.
- Staff can click a request to begin verification, taking it to the `REQUIREMENTS_VERIFICATION` state.
- Staff can download/preview nested requirement documents cleanly using the provided `file` URL.
- Staff can transition the request to `PAYMENT_PENDING` (success) or `REQUIREMENTS_REJECTED` (fail).
- Rejections must present a prompt to collect mandatory remarks before submission.
- The UI follows a highly dynamic and premium aesthetic using Tailwind CSS.

AI Prompt For Frontend Developer:
> Please implement Chunk 19: Staff Verification UI. Build the verification queue table and the verification modal workspace for staff. Use the new nested `documents` data on the `CredentialRequest` model to allow staff to preview documents. Implement the state transition workflow enforcing mandatory remarks on rejections. Design must be modern and utilize Tailwind CSS.

---

## Chunk 20: Payment Tracking API & Integration

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY (Backend APIs fully satisfied with Payment models and views)

Purpose:
Build the OTC cashier payment tracking UI. Students must upload a scanned image or photo of their official receipt after paying at the cashier. Staff must verify these receipts.

Dependencies:
Chunk 18, 19

Available Backend APIs:
- `POST /api/payments/` (Student submits OTC receipt evidence)
- `GET /api/payments/` (Staff list queue of payments)
- `GET /api/payments/{id}/download/` (Securely serve the OTC receipt image)
- `PATCH /api/payments/{id}/verify/` (Staff approves/rejects payment attempt)

Required Pages:
- Student Dashboard Integration (Modal or section for submitting payment when request is `PAYMENT_PENDING`)
- Staff Payment Verification Queue (`/staff/payments`)

Required Components:
- `PaymentUploadForm`: Allows students to enter `amount`, optional `receipt_reference_number`, and upload the `receipt_image`.
- `PaymentVerificationTable`: Displays pending payments for staff.
- `PaymentReviewModal`: Previews the nested `receipt_image` download URL and allows Staff to Verify or Reject (requiring remarks).

Acceptance Criteria:
- When a request is `PAYMENT_PENDING`, the student is prompted to upload OTC cashier receipt evidence.
- Rejected payments retain their history; the student is allowed to upload a new receipt if their previous one is rejected (the request stays in `PAYMENT_PENDING`).
- Staff verifying the payment advances the parent request to `PAYMENT_VERIFIED` automatically.
- Ensure the UI clearly communicates this is an OTC payment process and NOT an online gateway. Use words like "Cashier Receipt", "Upload Official Receipt".
- The UI follows a highly dynamic and premium aesthetic using Tailwind CSS.

AI Prompt For Frontend Developer:
> Please implement the Frontend portion of Chunk 20: OTC Payment Tracking. Build the student-facing receipt upload form for when their request hits PAYMENT_PENDING. Then build the Staff Payment Verification Queue where staff can preview the receipt image and verify or reject it. Remember this is an OTC (Over-The-Counter) payment process, so use terminology like "Cashier Receipt" and "Upload Proof". Design must be modern and utilize Tailwind CSS.

---

## Chunk 21: Registrar Processing API & UI

Owner: Full Stack Developer (Frontend Portion)

Status:
* READY (Backend APIs fully satisfied with state machine transitions and permissions)

Purpose:
Build the Registrar processing dashboard UI allowing Registrar staff to filter requests awaiting processing (`PAYMENT_VERIFIED`), transition them to `PROCESSING`, generate/prepare official credentials, and mark them as `READY_FOR_RELEASE` or `REJECTED` (with mandatory remarks).

Dependencies:
Chunk 18 (Workflow State Transition API), Chunk 20 (Payment Tracking API & Integration)

Available Backend APIs:
- `GET /api/requests/?status=PAYMENT_VERIFIED` (List requests awaiting registrar processing)
- `GET /api/requests/?status=PROCESSING` (List requests currently in processing)
- `GET /api/requests/` (Broad viewing of all requests for auditing/tracking)
- `GET /api/requests/{id}/` (View request details, document attachments, user details, and payments)
- `PATCH /api/requests/{id}/transition/` (Transition request status: `PAYMENT_VERIFIED` -> `PROCESSING`, `PROCESSING` -> `READY_FOR_RELEASE` or `REJECTED`)

Required Pages:
- Registrar Processing Dashboard (`/registrar/processing`)

Required Components:
- `ProcessingQueueTable`: Tabbed or filterable table displaying requests in `PAYMENT_VERIFIED` and `PROCESSING` states.
- `ProcessingWorkspaceModal`: Detailed view displaying student metadata, credential requested, uploaded requirement documents, and payment verification history.
- `TransitionActionPanel`: Buttons to advance status (`Begin Processing`, `Mark Ready for Release`, `Reject Request`).
- `MandatoryRemarksModal`: Prompts for rejection reason when transitioning to `REJECTED`.

Acceptance Criteria:
- Registrar staff can view requests filtered by `PAYMENT_VERIFIED` or `PROCESSING`, or view the complete request list for inquiry/auditing.
- Registrar can pick up a `PAYMENT_VERIFIED` request and transition it to `PROCESSING`.
- Registrar can complete processing and transition the request to `READY_FOR_RELEASE`.
- Rejections enforce entering mandatory remarks in the UI before submitting the transition call.
- The UI follows a highly dynamic and premium aesthetic using Tailwind CSS with status indicators, toast notifications, and seamless modal transitions.

AI Prompt For Frontend Developer:
> Please implement the Frontend portion of Chunk 21: Registrar Processing UI. Build the `/registrar/processing` dashboard allowing Registrars to view requests in `PAYMENT_VERIFIED` and `PROCESSING` states, preview student request details and attachments in a workspace modal, and trigger state transitions to `PROCESSING`, `READY_FOR_RELEASE`, or `REJECTED`. Ensure mandatory remarks are required and validated before submitting a rejection transition. Design must be modern, responsive, and utilize Tailwind CSS.

---

## Chunk 22: Release Workflow & Audit Viewing

Owner: Frontend Developer

Status:
* READY (Backend APIs fully satisfied by Chunk 18 transition endpoints)

Purpose:
Build the final Release Workflow interface for Staff/Registrar to transition `READY_FOR_RELEASE` requests to `RELEASED`, and provide an administrative view for inspecting request states and history.

Dependencies:
Chunk 18 (Workflow State Transition API), Chunk 21 (Registrar Processing API & UI)

Available Backend APIs:
- `GET /api/requests/?status=READY_FOR_RELEASE` (List requests awaiting release)
- `PATCH /api/requests/{id}/transition/` (Transition `READY_FOR_RELEASE` -> `RELEASED`)

Required Pages:
- Release Dashboard (`/staff/release`)

Required Components:
- `ReleaseQueueTable`: Table displaying requests ready for student collection/release.
- `ReleaseConfirmModal`: Modal to verify student identification and confirm release transition.

Acceptance Criteria:
- Staff/Registrar can view requests in `READY_FOR_RELEASE` status.
- Staff/Registrar can transition requests to `RELEASED` state.
- Design is modern, responsive, and uses Tailwind CSS.

AI Prompt For Frontend Developer:
> Please implement Chunk 22: Release Workflow & Audit Viewing. Build the `/staff/release` dashboard for Staff and Registrars to view requests in READY_FOR_RELEASE state and execute the final RELEASED transition. Ensure modern Tailwind CSS styling and clear success feedback.