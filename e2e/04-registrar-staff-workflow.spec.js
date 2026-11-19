import { test, expect } from '@playwright/test';
import {
  apiBaseUrl,
  loginAs,
  getAuthToken,
  credentials,
  createDummyPngBuffer,
  setRegistrarAutoApprove,
} from './helpers/authAndSeed.js';

test.describe('Suite 04: Registrar Assignment Status Preservation & Staff Payment Confirmation', () => {
  let registrarToken = null;
  let staffToken = null;
  let studentToken = null;
  let activeCredType = null;

  test.beforeAll(async ({ request }) => {
    const regAuth = await getAuthToken(request, 'registrar');
    registrarToken = regAuth.access;

    const staffAuth = await getAuthToken(request, 'staff');
    staffToken = staffAuth.access;

    const stuAuth = await getAuthToken(request, 'student');
    studentToken = stuAuth.access;

    const res = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${registrarToken}` },
    });
    const credTypes = await res.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    activeCredType = list.find((ct) => ct.is_active);
  });

  test('TC-REG-01: Assigning/reassigning staff strictly PRESERVES current request status', async ({ request }) => {
    test.setTimeout(90000);
    test.skip(!activeCredType, 'Active credential type required');

    // 1. Create a PENDING request (auto-approve OFF)
    await setRegistrarAutoApprove(request, registrarToken, false);
    const reqPendingRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeCredType.id,
        purpose: 'E2E Status Preservation Test - Pending',
        remarks: '[E2E-TEST] Preserve PENDING status on assign',
        copies: 1,
      },
    });
    const pendingReq = await reqPendingRes.json();
    expect(pendingReq.status).toBe('PENDING');

    // Assign to staff
    const assignRes1 = await request.post(`${apiBaseUrl}/api/requests/${pendingReq.id}/assign/`, {
      headers: {
        Authorization: `Bearer ${registrarToken}`,
        'Content-Type': 'application/json',
      },
      data: { assigned_staff: credentials.staff.id },
    });
    expect(assignRes1.ok()).toBeTruthy();

    const verifyReq1 = await (await request.get(`${apiBaseUrl}/api/requests/${pendingReq.id}/`, {
      headers: { Authorization: `Bearer ${registrarToken}` },
    })).json();
    // Status MUST still be PENDING, never prematurely FOR_PROCESSING
    expect(verifyReq1.status).toBe('PENDING');

    // 2. Create request and transition to PAYMENT_PENDING
    const reqPayRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeCredType.id,
        purpose: 'E2E Status Preservation Test - Payment',
        remarks: '[E2E-TEST] Preserve PAYMENT_PENDING status on assign',
        copies: 1,
      },
    });
    const payReq = await reqPayRes.json();

    // Transition to PAYMENT_PENDING
    await request.patch(`${apiBaseUrl}/api/requests/${payReq.id}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'PAYMENT_PENDING' },
    });

    // Assign to staff
    const assignRes2 = await request.post(`${apiBaseUrl}/api/requests/${payReq.id}/assign/`, {
      headers: {
        Authorization: `Bearer ${registrarToken}`,
        'Content-Type': 'application/json',
      },
      data: { assigned_staff: credentials.staff.id },
    });
    expect(assignRes2.ok()).toBeTruthy();

    const verifyReq2 = await (await request.get(`${apiBaseUrl}/api/requests/${payReq.id}/`, {
      headers: { Authorization: `Bearer ${registrarToken}` },
    })).json();
    expect(verifyReq2.status).toBe('PAYMENT_PENDING');
  });

  test('TC-STAFF-01: Staff confirms payment (FOR_VERIFICATION -> PAYMENT_VERIFIED)', async ({ request }) => {
    test.setTimeout(90000);
    test.skip(!activeCredType, 'Active credential type required');

    // 1. Create request & submit payment proof to enter FOR_VERIFICATION
    await setRegistrarAutoApprove(request, registrarToken, true);
    const createRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeCredType.id,
        purpose: 'Staff Payment Confirmation Test',
        remarks: '[E2E-TEST] Testing Staff Payment Confirmation',
        copies: 1,
      },
    });
    const reqData = await createRes.json();

    // Staff transitions request to PAYMENT_PENDING before student payment
    await request.patch(`${apiBaseUrl}/api/requests/${reqData.id}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'PAYMENT_PENDING' },
    });

    const uniqueOr = `OR-CONFIRM-${Date.now()}`;
    const pngBuffer = createDummyPngBuffer();
    const payRes = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      multipart: {
        request: String(reqData.id),
        amount: '150.00',
        or_number: uniqueOr,
        receipt_image: { name: 'r.png', mimeType: 'image/png', buffer: pngBuffer },
      },
    });
    const payment = await payRes.json();

    // 2. Staff confirms payment proof via PATCH
    const verifyPayRes = await request.patch(`${apiBaseUrl}/api/payments/${payment.id}/verify/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        action: 'VERIFY',
        remarks: 'Payment verified by staff',
      },
    });
    expect(verifyPayRes.ok()).toBeTruthy();

    // 3. Verify request transitioned to PAYMENT_VERIFIED or PROCESSING
    const checkReq = await (await request.get(`${apiBaseUrl}/api/requests/${reqData.id}/`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    })).json();
    expect(['PAYMENT_VERIFIED', 'FOR_PROCESSING', 'PROCESSING']).toContain(checkReq.status);
  });

  test('TC-STAFF-02: Staff Processing Calendar renders queue and scheduled requests', async ({ page }) => {
    test.setTimeout(90000);
    await loginAs(page, 'staff');
    await page.goto('/staff/calendar');
    await page.waitForLoadState('domcontentloaded');

    // Verify calendar header and month grid are visible
    const calIndicator = page.locator('text=/Processing Calendar|All Active Batches|Today|Release/i')
      .filter({ visible: true })
      .first();
    await expect(calIndicator).toBeVisible({ timeout: 20000 });
  });
});

