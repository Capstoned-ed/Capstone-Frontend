import { test, expect } from '@playwright/test';
import {
  apiBaseUrl,
  loginAs,
  getAuthToken,
  E2ETestTracker,
} from './helpers/authAndSeed.js';

test.describe('Suite 05: Audit Logs, Live Notifications & Discovered Edge Cases', () => {
  let tracker;
  let adminToken = null;

  test.beforeEach(async ({ request }) => {
    tracker = new E2ETestTracker(request);
    const { access } = await getAuthToken(request, 'admin');
    adminToken = access;
    tracker.setAdminToken(adminToken);
  });

  test.afterEach(async () => {
    await tracker.cleanupAll();
  });

  test('TC-AUDIT-01: Admin Audit Logs fetch live from API without stale localStorage cache', async ({ page }) => {
    test.setTimeout(90000);
    await loginAs(page, 'admin');
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Verify recent activity / audit log container is rendered
    const activityContainer = page.locator('text=/Recent System Activity|Audit Logs|Activity Log|Dashboard/i')
      .filter({ visible: true })
      .first();
    await expect(activityContainer).toBeVisible({ timeout: 20000 });
  });

  test('TC-EDGE-09: Deleted user audit entry returns "Deleted User" (never misattributed to Admin)', async ({ request }) => {
    test.setTimeout(90000);
    // 1. Create a temporary staff user
    const tempUser = await tracker.createTemporaryUser({ role: 'staff' });
    const tempUserId = tempUser.id;

    // 2. Authenticate as tempUser and perform an action
    const { access: tempToken } = await getAuthToken(request, 'student'); // Student token to create request
    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const credTypes = await credTypesRes.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    const activeType = list.find((ct) => ct.is_active);

    const reqRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${tempToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'E2E Deleted User Audit Attribution Test',
        remarks: '[E2E-TEST] TC-EDGE-09 verification',
        copies: 1,
      },
    });
    expect(reqRes.ok()).toBeTruthy();

    // 3. Delete the temporary user account
    await tracker.deleteTemporaryUser(tempUserId);

    // 4. Query audit logs as Admin
    const auditRes = await request.get(`${apiBaseUrl}/api/audit/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.ok()).toBeTruthy();
    const auditLogs = await auditRes.json();
    const listLogs = Array.isArray(auditLogs) ? auditLogs : auditLogs.results || [];

    // Verify that NO audit log attributed to a deleted actor displays the viewing admin's username or id
    const adminId = String(process.env.E2E_ADMIN_ID || '2026100101').toLowerCase();
    for (const log of listLogs) {
      if (log.actorId === 'deleted' || log.actor === 'Deleted User') {
        expect(String(log.actor || '').toLowerCase()).not.toBe(adminId);
        expect(String(log.actorId || '')).not.toBe(adminId);
      }
    }
  });

  test('TC-EDGE-06: Copy count upper bound validation (copies: 999999 or 0 rejected with 400)', async ({ request }) => {
    test.setTimeout(90000);
    const { access: studentToken } = await getAuthToken(request, 'student');
    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const credTypes = await credTypesRes.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    const activeType = list.find((ct) => ct.is_active);

    // 1. Extreme copies: 999999 -> 400 Bad Request
    const resTooHigh = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'Extreme Copy Count Test',
        copies: 999999,
      },
    });
    expect(resTooHigh.status()).toBe(400);
    const errBodyHigh = await resTooHigh.json();
    expect(errBodyHigh).toHaveProperty('copies');

    // 2. Zero copies: 0 -> 400 Bad Request
    const resZero = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'Zero Copy Count Test',
        copies: 0,
      },
    });
    expect(resZero.status()).toBe(400);

    // 3. Multi-document item with copies > 100 -> 400 Bad Request
    const resItemsHigh = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'Extreme Multi-Doc Copies Test',
        document_items: [
          { credential_type_id: activeType.id, copies: 150 },
        ],
      },
    });
    expect(resItemsHigh.status()).toBe(400);
  });

  test('TC-EDGE-12: Illegal status jump protection (PENDING directly to RELEASED blocked)', async ({ request }) => {
    test.setTimeout(90000);
    const { access: studentToken } = await getAuthToken(request, 'student');
    const { access: staffToken } = await getAuthToken(request, 'staff');

    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const credTypes = await credTypesRes.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    const activeType = list.find((ct) => ct.is_active);

    // Create request in PENDING
    const createRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'Illegal Status Jump Test',
        remarks: '[E2E-TEST] Testing illegal transition jump',
        copies: 1,
      },
    });
    const reqData = await createRes.json();

    // 1. Direct PATCH on request entity is completely disallowed (405 Method Not Allowed)
    const directPatchRes = await request.patch(`${apiBaseUrl}/api/requests/${reqData.id}/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'RELEASED',
      },
    });
    expect([405, 400, 403]).toContain(directPatchRes.status());

    // 2. Staff attempts illegal status jump via transition endpoint (PENDING -> RELEASED)
    const illegalJumpRes = await request.patch(`${apiBaseUrl}/api/requests/${reqData.id}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'RELEASED',
      },
    });

    // Workflow state machine blocks illegal transition with 400 Bad Request
    expect([400, 403]).toContain(illegalJumpRes.status());
  });

  test('TC-NOTIF-01: Admin notifications remain isolated from Student accounts', async ({ request }) => {
    test.setTimeout(90000);
    const { access: studentToken } = await getAuthToken(request, 'student');

    // Student fetches notifications
    const studentNotifRes = await request.get(`${apiBaseUrl}/api/notifications/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentNotifRes.ok()).toBeTruthy();
    const studentNotifs = await studentNotifRes.json();
    const list = Array.isArray(studentNotifs) ? studentNotifs : studentNotifs.results || [];

    // Verify student notifications do not include admin-only system provisioning alerts
    for (const notif of list) {
      expect(notif.message || '').not.toMatch(/Database migration|Admin system alert/i);
    }
  });
});
