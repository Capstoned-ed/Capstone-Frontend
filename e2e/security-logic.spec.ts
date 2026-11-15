import { test, expect } from '@playwright/test';
import { loginAs, performLogout, credentials, apiBaseUrl, getAuthToken } from './helpers';

test.describe('Security & Business Logic Hardening', () => {

  // ---------------------------------------------------------------------------
  // 1. Authentication, Negative Login & Unauthenticated Boundaries
  // ---------------------------------------------------------------------------
  test.describe('1. Authentication & Route Guards', () => {
    test('Browser: reject invalid credentials and show error banner', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#username').fill('99999999');
      await page.locator('#password').fill('wrongpassword123!');
      await page.getByRole('button', { name: /Log In/i }).click();

      const errorBanner = page.locator('.animate-fadeIn, [class*="bg-red-50"]');
      await expect(errorBanner).toBeVisible({ timeout: 30000 });
      await expect(errorBanner).toContainText(
        /No active account found|Invalid credentials|failed|unable/i
      );
    });

    test('Browser: unauthenticated access to protected routes redirects to /login', async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());

      const protectedRoutes = ['/admin/users', '/staff/dashboard', '/student/profile'];
      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
      }
    });

    test('API: unauthenticated access to sensitive endpoints returns 401 Unauthorized', async ({ request }) => {
      const endpoints = [
        '/api/users/',
        '/api/requests/',
        '/api/clearances/',
        '/api/payments/',
        '/api/documents/',
        '/api/credentials/forecast/daily/',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${apiBaseUrl}${endpoint}`);
        expect(response.status()).toBe(401);
      }
    });

    test('API: unauthenticated file download returns 401 Unauthorized', async ({ request }) => {
      const endpoints = [
        '/api/clearances/1/download/',
        '/api/documents/1/download/',
        '/api/payments/1/download/',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${apiBaseUrl}${endpoint}`);
        expect(response.status()).toBe(401);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Role Permission Boundaries (RBAC Enforcement)
  // ---------------------------------------------------------------------------
  test.describe('2. Role Permission Boundaries (RBAC)', () => {
    test('API: Student and Staff cannot access or create users (Admin only)', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');
      const staffToken = await getAuthToken(request, 'staff');

      // Student GET users -> 403
      const studentGet = await request.get(`${apiBaseUrl}/api/users/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(studentGet.status()).toBe(403);

      // Student POST user -> 403
      const studentPost = await request.post(`${apiBaseUrl}/api/users/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { username: 'malicious', password: 'password123', role: 'STUDENT' },
      });
      expect(studentPost.status()).toBe(403);

      // Staff GET users -> 403
      const staffGet = await request.get(`${apiBaseUrl}/api/users/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(staffGet.status()).toBe(403);
    });

    test('Browser: Student accessing Admin User Management is blocked by role guard', async ({ page }) => {
      await loginAs(page, 'student');
      await page.goto('/admin/users');
      // RoleRoute redirects unauthorized users to /403 or dashboard
      await page.waitForURL(/\/(403|forbidden|student)/, { timeout: 15000 });
      await expect(page.locator('body')).toContainText(/Access Restricted|403|Dashboard|Student/i);
    });

    test('Browser: Staff accessing Admin User Management is blocked by role guard', async ({ page }) => {
      await loginAs(page, 'staff');
      await page.goto('/admin/users');
      await page.waitForURL(/\/(403|forbidden|staff)/, { timeout: 15000 });
      await expect(page.locator('body')).toContainText(/Access Restricted|403|Dashboard|Staff/i);
    });

    test('API: Staff and Admin cannot create credential requests (Students only)', async ({ request }) => {
      const staffToken = await getAuthToken(request, 'staff');
      const adminToken = await getAuthToken(request, 'admin');

      const staffCreate = await request.post(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
        data: { credential_type: 1 },
      });
      expect(staffCreate.status()).toBe(403);

      const adminCreate = await request.post(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { credential_type: 1 },
      });
      expect(adminCreate.status()).toBe(403);
    });

    test('API: Student cannot access ML demand forecasting analytics', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');

      const dailyForecast = await request.get(`${apiBaseUrl}/api/credentials/forecast/daily/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(dailyForecast.status()).toBe(403);

      const monthlyWorkload = await request.get(`${apiBaseUrl}/api/credentials/forecast/monthly-workload/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(monthlyWorkload.status()).toBe(403);
    });

    test('API: Student cannot review clearances or verify payments', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');

      // Attempt to review clearance
      const clearanceReview = await request.patch(`${apiBaseUrl}/api/clearances/1/review/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        multipart: { status: 'APPROVED' },
      });
      expect(clearanceReview.status()).toBe(403);

      // Attempt to verify payment
      const paymentVerify = await request.patch(`${apiBaseUrl}/api/payments/1/verify/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { action: 'VERIFY' },
      });
      expect(paymentVerify.status()).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Insecure Direct Object Reference (IDOR) & Queryset Isolation
  // ---------------------------------------------------------------------------
  test.describe('3. IDOR Defense & Queryset Isolation', () => {
    test('API: Student cannot view another student credential request detail (returns 404)', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');
      const staffToken = await getAuthToken(request, 'staff');

      // Staff sees all requests
      const staffResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const staffData = await staffResp.json();
      const allRequests = Array.isArray(staffData) ? staffData : (staffData.results || []);

      // Student requests
      const studentResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const studentData = await studentResp.json();
      const studentRequests = Array.isArray(studentData) ? studentData : (studentData.results || []);
      const studentReqIds = new Set(studentRequests.map((r: any) => r.id));

      // Find a request belonging to someone else
      const otherRequest = allRequests.find((r: any) => !studentReqIds.has(r.id));
      const targetId = otherRequest ? otherRequest.id : '00000000-0000-0000-0000-000000000000';

      // Student direct access -> 404
      const idorDetail = await request.get(`${apiBaseUrl}/api/requests/${targetId}/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(idorDetail.status()).toBe(404);

      // Student transition attempt on other student request -> 404
      const idorTransition = await request.patch(`${apiBaseUrl}/api/requests/${targetId}/transition/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { status: 'CANCELLED' },
      });
      expect(idorTransition.status()).toBe(404);
    });

    test('API: Student request list isolates records to owner only', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');
      const staffToken = await getAuthToken(request, 'staff');

      // Fetch student requests
      const studentResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(studentResp.status()).toBe(200);

      const studentRequests = await studentResp.json();
      const studentReqList = Array.isArray(studentRequests) ? studentRequests : (studentRequests.results || []);

      if (studentReqList.length > 0) {
        // All student items must belong to the exact same user PK
        const ownerPks = new Set(studentReqList.map((r: any) => r.user));
        expect(ownerPks.size).toBe(1);
        const studentUserPk = studentReqList[0].user;

        // Fetch staff list to verify cross-tenant records are excluded from student list
        const staffResp = await request.get(`${apiBaseUrl}/api/requests/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
        });
        const staffData = await staffResp.json();
        const staffReqList = Array.isArray(staffData) ? staffData : (staffData.results || []);

        const otherUserRequests = staffReqList.filter((r: any) => r.user !== studentUserPk);
        const studentReqIds = new Set(studentReqList.map((r: any) => r.id));

        for (const otherReq of otherUserRequests) {
          expect(studentReqIds.has(otherReq.id)).toBeFalsy();
        }
      }
    });

    test('API: Student cannot access or download another student clearance file', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');
      const staffToken = await getAuthToken(request, 'staff');

      // Staff gets all clearances
      const staffResp = await request.get(`${apiBaseUrl}/api/clearances/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const staffData = await staffResp.json();
      const clearances = Array.isArray(staffData) ? staffData : (staffData.results || []);

      // Student clearances
      const studentResp = await request.get(`${apiBaseUrl}/api/clearances/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const studentData = await studentResp.json();
      const studentClearances = Array.isArray(studentData) ? studentData : (studentData.results || []);
      const studentClearanceIds = new Set(studentClearances.map((c: any) => c.id));

      // Find a clearance NOT belonging to this student
      const otherClearance = clearances.find((c: any) => !studentClearanceIds.has(c.id));
      const targetClearanceId = otherClearance ? otherClearance.id : '00000000-0000-0000-0000-000000000000';

      const downloadResp = await request.get(`${apiBaseUrl}/api/clearances/${targetClearanceId}/download/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      // Ownership check & queryset filtering returns 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(downloadResp.status());
    });

    test('API: Student cannot upload documents attached to another student request', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');
      const staffToken = await getAuthToken(request, 'staff');

      // Find another student's request ID
      const staffResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const staffData = await staffResp.json();
      const allRequests = Array.isArray(staffData) ? staffData : (staffData.results || []);

      const studentResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const studentData = await studentResp.json();
      const studentRequests = Array.isArray(studentData) ? studentData : (studentData.results || []);
      const studentReqIds = new Set(studentRequests.map((r: any) => r.id));

      const otherReq = allRequests.find((r: any) => !studentReqIds.has(r.id));
      const targetReqId = otherReq ? otherReq.id : '00000000-0000-0000-0000-000000000000';

      const uploadResp = await request.post(`${apiBaseUrl}/api/documents/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        multipart: {
          request: targetReqId,
          document_type: 'ID',
          file: {
            name: 'tamper.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\nMalicious upload attempt'),
          },
        },
      });

      // Must reject cross-tenant upload with 400 Bad Request or 404
      expect([400, 404]).toContain(uploadResp.status());
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Workflow State Machine Hardening & Edge-Case Business Rules
  // ---------------------------------------------------------------------------
  test.describe('4. State Machine Invariants & Business Logic', () => {
    test('API: Student cannot perform staff-level transitions (e.g. REQUIREMENTS_VERIFICATION)', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');

      // Get one of student's requests
      const listResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data = await listResp.json();
      const requests = Array.isArray(data) ? data : (data.results || []);
      expect(requests.length).toBeGreaterThan(0);

      const targetReq = requests.find((r: any) => r.status === 'PENDING') || requests[0];
      const transResp = await request.patch(`${apiBaseUrl}/api/requests/${targetReq.id}/transition/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { status: 'REQUIREMENTS_VERIFICATION' },
      });

      // Students lack permission for staff transition -> 403 Forbidden (or 400 if state jump invalid)
      expect([400, 403]).toContain(transResp.status());
    });

    test('API: State machine prohibits invalid jumps and role-restricted transitions', async ({ request }) => {
      const staffToken = await getAuthToken(request, 'staff');

      const listResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await listResp.json();
      const requests = Array.isArray(data) ? data : (data.results || []);
      const targetReq = requests[0];

      if (targetReq) {
        // Attempting to jump directly to READY_FOR_RELEASE without going through PROCESSING
        // is prohibited by the state machine (400 Bad Request) or permission denied (403 Forbidden)
        const transResp = await request.patch(`${apiBaseUrl}/api/requests/${targetReq.id}/transition/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
          data: { status: 'READY_FOR_RELEASE' },
        });

        expect([400, 403]).toContain(transResp.status());
      }
    });

    test('API: Rejecting a credential request requires non-empty remarks or valid state', async ({ request }) => {
      const staffToken = await getAuthToken(request, 'staff');

      const listResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await listResp.json();
      const requests = Array.isArray(data) ? data : (data.results || []);

      // Find or advance a request to REQUIREMENTS_VERIFICATION where rejection is a valid action
      let targetReq = requests.find((r: any) => ['REQUIREMENTS_VERIFICATION', 'PAYMENT_PENDING', 'PROCESSING'].includes(r.status));
      if (!targetReq && requests.length > 0) {
        const reqToAdvance = requests.find((r: any) => r.status === 'PENDING') || requests[0];
        const advanceResp = await request.patch(`${apiBaseUrl}/api/requests/${reqToAdvance.id}/transition/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
          data: { status: 'REQUIREMENTS_VERIFICATION' },
        });
        if (advanceResp.ok()) {
          targetReq = await advanceResp.json();
        } else {
          targetReq = reqToAdvance;
        }
      }

      if (targetReq) {
        // Rejection without remarks -> 400 Bad Request
        const rejectResp = await request.patch(`${apiBaseUrl}/api/requests/${targetReq.id}/transition/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
          data: { status: 'REJECTED' },
        });

        expect(rejectResp.status()).toBe(400);
        const bodyText = await rejectResp.text();
        expect(bodyText.toLowerCase()).toMatch(/remarks|invalid transition/i);
      }
    });

    test('API: Rejecting a student clearance requires remarks', async ({ request }) => {
      const staffToken = await getAuthToken(request, 'staff');

      const clearResp = await request.get(`${apiBaseUrl}/api/clearances/`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await clearResp.json();
      const clearances = Array.isArray(data) ? data : (data.results || []);

      if (clearances.length > 0) {
        const targetClearance = clearances[0];
        const reviewResp = await request.patch(`${apiBaseUrl}/api/clearances/${targetClearance.id}/review/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
          multipart: { status: 'REJECTED' },
        });

        expect(reviewResp.status()).toBe(400);
        const body = await reviewResp.text();
        expect(body.toLowerCase()).toContain('remarks');
      }
    });

    test('API: Requesting an invalid or non-existent credential type is rejected', async ({ request }) => {
      const studentToken = await getAuthToken(request, 'student');

      const response = await request.post(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { credential_type: 999999 },
      });

      expect(response.status()).toBe(400);
    });

    test('API: Safe methods enforcement - DELETE request directly is forbidden', async ({ request }) => {
      const adminToken = await getAuthToken(request, 'admin');

      const listResp = await request.get(`${apiBaseUrl}/api/requests/`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await listResp.json();
      const requests = Array.isArray(data) ? data : (data.results || []);

      if (requests.length > 0) {
        const targetReq = requests[0];
        const deleteResp = await request.delete(`${apiBaseUrl}/api/requests/${targetReq.id}/`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        // Hardened permission class blocks non-safe methods (403 or 405)
        expect([403, 405]).toContain(deleteResp.status());
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Same-Browser Session Switch & Zero Cache Leakage
  // ---------------------------------------------------------------------------
  test.describe('5. Same-Browser Session Switch & Cache Isolation', () => {
    test('Browser: User A logs out, storage is completely wiped, User B logs in without data leakage', async ({ page }) => {
      // Step 1: Login as User A (Student) on browser page
      await loginAs(page, 'student');
      await expect(page).toHaveURL(/\/student/);

      // Student navigates to requests / tracking page
      await page.goto('/student/requests');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toContainText(/Track|Request|Status/i);

      // Student views notifications page
      await page.goto('/notifications');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toContainText(/Notification/i);

      // Step 2: User A logs out using UI logout flow
      await performLogout(page);

      // Verify that full reload took user to /login and purged all auth tokens and User A cache
      await expect(page).toHaveURL(/\/login/);
      const storageState = await page.evaluate((studentId) => {
        return {
          token: localStorage.getItem('access_token'),
          refresh: localStorage.getItem('refresh_token'),
          userRequests: localStorage.getItem(`requests_${studentId}`),
          studentRequests: localStorage.getItem('student_my_requests'),
        };
      }, credentials.student.id);

      expect(storageState.token).toBeNull();
      expect(storageState.refresh).toBeNull();
      expect(storageState.userRequests).toBeNull();
      expect(storageState.studentRequests).toBeNull();

      // Step 3: Within the EXACT SAME page/context, User B (Staff) logs in
      const idInput = page.locator('#username');
      const passwordInput = page.locator('#password');
      const submitButton = page.getByRole('button', { name: /Log In/i });

      await idInput.fill(credentials.staff.id);
      await passwordInput.fill(credentials.staff.password);
      await submitButton.click();

      // Verify User B is redirected to /staff dashboard
      await page.waitForURL(/\/staff/, { timeout: 60000 });
      await expect(page.locator('body')).toContainText(/Staff|Dashboard|Overview|Requests/i);

      // Step 4: Verify User B's storage does not contain any User A data or keys
      await page.goto('/notifications');
      await page.waitForLoadState('domcontentloaded');

      const leakedKeys = await page.evaluate((studentId) => {
        const leaked = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) || '';
          if (k.includes(studentId) || k.includes('student_my_requests')) {
            leaked.push(k);
          }
        }
        return leaked;
      }, credentials.student.id);

      expect(leakedKeys).toEqual([]);
    });
  });
});
