import { test, expect } from '@playwright/test';
import {
  apiBaseUrl,
  loginAs,
  getAuthToken,
  createDummyPngBuffer,
  setRegistrarAutoApprove,
} from './helpers/authAndSeed.js';

test.describe('Suite 03: Payment Proof Submission, Duplicate O.R. Handling & FOR_VERIFICATION', () => {
  let studentToken = null;
  let activeCredType = null;

  test.beforeAll(async ({ request }) => {
    const { access } = await getAuthToken(request, 'student');
    studentToken = access;

    // Fetch active credential type
    const res = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const credTypes = await res.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    activeCredType = list.find((ct) => ct.is_active);
  });

  test('TC-PAY-01: Payment submission transitions PAYMENT_PENDING -> FOR_VERIFICATION', async ({ request }) => {
    test.setTimeout(90000);
    test.skip(!activeCredType, 'Active credential type required');

    const { access: staffToken } = await getAuthToken(request, 'staff');

    // 1. Create request as student
    const createRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeCredType.id,
        purpose: 'E2E Payment Verification Test',
        remarks: '[E2E-TEST] Payment status transition test',
        copies: 1,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const reqData = await createRes.json();

    // 2. Staff transitions request to PAYMENT_PENDING
    const transRes = await request.patch(`${apiBaseUrl}/api/requests/${reqData.id}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'PAYMENT_PENDING' },
    });
    expect(transRes.ok()).toBeTruthy();

    // 3. Submit payment proof
    const uniqueOr = `E2E-OR-${Date.now()}`;
    const pngBuffer = createDummyPngBuffer();

    const paymentRes = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
      multipart: {
        request: String(reqData.id),
        amount: '150.00',
        or_number: uniqueOr,
        receipt_image: {
          name: 'receipt.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });
    expect(paymentRes.ok()).toBeTruthy();

    // 4. Verify request transitioned to FOR_VERIFICATION
    const checkReqRes = await request.get(`${apiBaseUrl}/api/requests/${reqData.id}/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(checkReqRes.ok()).toBeTruthy();
    const updatedReq = await checkReqRes.json();
    expect(updatedReq.status).toBe('FOR_VERIFICATION');
  });

  test('TC-PAY-02: Duplicate O.R. number returns clean 400 Bad Request JSON (no raw HTML toast crash)', async ({ request, page }) => {
    test.setTimeout(90000);
    test.skip(!activeCredType, 'Active credential type required');

    const { access: staffToken } = await getAuthToken(request, 'staff');

    // 1. Create two requests and transition them to PAYMENT_PENDING
    const createReq = async () => {
      const res = await request.post(`${apiBaseUrl}/api/requests/`, {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          credential_type: activeCredType.id,
          purpose: 'Duplicate OR Test',
          remarks: '[E2E-TEST] Duplicate OR verification',
          copies: 1,
        },
      });
      const r = await res.json();
      await request.patch(`${apiBaseUrl}/api/requests/${r.id}/transition/`, {
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        data: { status: 'PAYMENT_PENDING' },
      });
      return r;
    };

    const req1 = await createReq();
    const req2 = await createReq();

    const sharedOrNumber = `OR-DUP-${Date.now()}`;
    const pngBuffer = createDummyPngBuffer();

    // 2. First payment succeeds with sharedOrNumber
    const pay1 = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      multipart: {
        request: String(req1.id),
        amount: '100.00',
        or_number: sharedOrNumber,
        receipt_image: {
          name: 'r1.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });
    expect(pay1.ok()).toBeTruthy();

    // 3. Second payment with the exact same OR number (trimmed / case-insensitive)
    const pay2 = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      multipart: {
        request: String(req2.id),
        amount: '100.00',
        or_number: `  ${sharedOrNumber.toLowerCase()}  `,
        receipt_image: {
          name: 'r2.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });

    // Must return 400 Bad Request, NOT a 500 HTML error
    expect(pay2.status()).toBe(400);
    const errBody = await pay2.json();
    expect(errBody).toHaveProperty('or_number');
    const msg = Array.isArray(errBody.or_number) ? errBody.or_number[0] : String(errBody.or_number);
    expect(msg).toContain('already in use');

    // Verify frontend does not render raw HTML if tested via UI
    await loginAs(page, 'student');
    await page.goto('/student/payments');
    await page.waitForLoadState('domcontentloaded');

    // Check that toast/modal containers do not leak raw HTML
    const rawHtmlNotice = page.locator('text=/<!doctype html>|<html|<head/i');
    await expect(rawHtmlNotice).not.toBeVisible();
  });

  test('TC-PAY-03 (TC-EDGE-13): Payment re-submission after rejection preserves flow', async ({ request }) => {
    test.setTimeout(90000);
    test.skip(!activeCredType, 'Active credential type required');

    const { access: staffToken } = await getAuthToken(request, 'staff');

    // Create request
    const createRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeCredType.id,
        purpose: 'E2E Rejected Payment Recovery',
        remarks: '[E2E-TEST] Testing payment re-submission after rejection',
        copies: 1,
      },
    });
    const reqData = await createRes.json();

    // Staff transitions request to PAYMENT_PENDING
    await request.patch(`${apiBaseUrl}/api/requests/${reqData.id}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'PAYMENT_PENDING' },
    });

    // Student submits first payment proof
    const firstOr = `OR-REJ1-${Date.now()}`;
    const pngBuffer = createDummyPngBuffer();
    const pay1 = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      multipart: {
        request: String(reqData.id),
        amount: '150.00',
        or_number: firstOr,
        receipt_image: { name: 'r1.png', mimeType: 'image/png', buffer: pngBuffer },
      },
    });
    expect(pay1.ok()).toBeTruthy();
    const paymentRecord = await pay1.json();

    // Staff rejects first payment proof via PATCH
    const rejectRes = await request.patch(`${apiBaseUrl}/api/payments/${paymentRecord.id}/verify/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        action: 'REJECT',
        remarks: 'Receipt image blurry',
      },
    });
    expect(rejectRes.ok()).toBeTruthy();

    // Student can now submit fresh replacement payment proof
    const secondOr = `OR-REJ2-${Date.now()}`;
    const pay2 = await request.post(`${apiBaseUrl}/api/payments/`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      multipart: {
        request: String(reqData.id),
        amount: '150.00',
        or_number: secondOr,
        receipt_image: { name: 'r2.png', mimeType: 'image/png', buffer: pngBuffer },
      },
    });
    expect(pay2.ok()).toBeTruthy();
  });
});

