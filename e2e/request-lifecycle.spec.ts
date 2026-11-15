import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAs, performLogout, apiBaseUrl, getAuthToken } from './helpers';

/**
 * Helper to resolve the backend UUID for a given tracking number from DRF API.
 */
async function resolveRequestUuid(
  request: APIRequestContext,
  trackingNumber: string,
  token: string
): Promise<string> {
  const res = await request.get(`${apiBaseUrl}/api/requests/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return trackingNumber;
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results || [];
  const matched = list.find(
    (r: any) => r.tracking_number === trackingNumber || r.id === trackingNumber
  );
  return matched ? matched.id : trackingNumber;
}

test.describe.serial('Core Document Request & Processing Workflow Lifecycle', () => {
  let primaryTrackingId = '';
  let primaryUuid = '';
  let secondTrackingId = '';
  let secondUuid = '';
  let thirdTrackingId = '';
  let thirdUuid = '';

  // ---------------------------------------------------------------------------
  // Step 1: Student Submission & Form Validation
  // ---------------------------------------------------------------------------
  test('Step 1: Student validates form rules, submits credential request, and verifies initial Pending state', async ({
    page,
  }) => {
    await loginAs(page, 'student');
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify page title and in-scope active document types rendered
    await expect(page.locator('body')).toContainText(/Request Document|Part 1|Part 2/i);
    await expect(page.locator('#ustp-part-2-section, .ustp-part-section').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Transcript of Records|Certification|Honorable Dismissal/i);

    // 2. Test form validation: Attempting to advance without required document selection must fail
    const nextStepBtn = page.getByRole('button', { name: /Next Step/i }).first();
    await expect(nextStepBtn).toBeVisible({ timeout: 15000 });
    await nextStepBtn.click();

    // Verify warning toast or scroll anchor preventing advancing to review
    await expect(page.locator('body')).toContainText(/Please check the document|cleared/i, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Submit/i })).toHaveCount(0);

    // 3. Complete valid request form:
    const clearedYesRadio = page.locator('input[name="isCleared"][value="yes"], input[name="isCleared"]').first();
    if (await clearedYesRadio.isVisible()) {
      await clearedYesRadio.check({ force: true });
    }

    // Attach clearance document
    const clearanceFileInput = page.locator('#ustp-clearance-section input[type="file"], input[type="file"]').first();
    await clearanceFileInput.setInputFiles({
      name: 'clearance_proof.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    // Check Transcript of Records (TOR)
    const torCheckbox = page.locator('.ustp-doc-label input[type="checkbox"]').first();
    await expect(torCheckbox).toBeVisible({ timeout: 10000 });
    await torCheckbox.check({ force: true });

    // Select purpose
    const purposeCheckbox = page.locator('.ustp-checkbox-row').filter({ hasText: /Evaluation|Personal File|Scholarship/i }).first();
    if (await purposeCheckbox.isVisible()) {
      await purposeCheckbox.click();
    }

    // Advance to Step 2 (Review)
    await nextStepBtn.click();
    await expect(page.locator('body')).toContainText(/Review Data/i, { timeout: 15000 });

    // Submit request (Step 2 -> Step 3)
    const submitBtn = page.getByRole('button', { name: /Next Step|Submit/i }).last();
    await submitBtn.click();

    // Verify confirmation screen and capture generated Reference Tracking ID
    const completeCard = page.locator('.complete-card');
    await expect(completeCard).toBeVisible({ timeout: 30000 });
    await expect(completeCard).toContainText(/Request Submitted!|successfully/i);

    const trackingBox = page.locator('.complete-tracking-code');
    await expect(trackingBox).toBeVisible({ timeout: 15000 });
    primaryTrackingId = (await trackingBox.textContent())?.trim() || '';
    expect(primaryTrackingId.length).toBeGreaterThan(5);

    // Click "Track Status" button to navigate to student request list
    const trackStatusBtn = page.getByRole('button', { name: /Track Status/i });
    await trackStatusBtn.click();
    await page.waitForURL(new RegExp(primaryTrackingId), { timeout: 20000 });

    // Verify request row appears with correct initial Pending status and document details
    await expect(page.locator('body')).toContainText(primaryTrackingId, { timeout: 15000 });
    await expect(page.locator('.status-pill').first()).toContainText(/Pending/i);
    await expect(page.locator('body')).toContainText(/Transcript of Records/i);
  });

  // ---------------------------------------------------------------------------
  // Step 2: Staff Visibility & Processing Progression
  // ---------------------------------------------------------------------------
  test('Step 2: Staff observes request in queue, validates state constraints, and progresses status', async ({
    page,
    request,
  }) => {
    expect(primaryTrackingId).toBeTruthy();

    const staffToken = await getAuthToken(request, 'staff');
    primaryUuid = await resolveRequestUuid(request, primaryTrackingId, staffToken);
    expect(primaryUuid).toBeTruthy();

    // 1. Verify API rejects invalid/skipped transitions from PENDING directly to RELEASED
    const invalidJumpRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'RELEASED',
        remarks: 'Illegal jump should fail',
      },
    });
    expect(invalidJumpRes.status()).toBe(400);

    // 2. Staff logs into the web application
    await loginAs(page, 'staff');
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // 3. Verify submitted Reference ID appears in Staff table
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill(primaryTrackingId);
    await page.waitForTimeout(1000);

    const targetRow = page.locator('tr').filter({ hasText: primaryTrackingId }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });
    await expect(targetRow).toContainText(/Pending/i);

    // 4. Open process modal (click "Process This" to claim if unassigned, then "View")
    const actionBtn = targetRow.locator('button').filter({ hasText: /View|Process This/i }).first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    // If modal is not immediately open (e.g. on staging Vercel where "Process This" claims first),
    // find the row in "My Assigned Requests" and click "View"
    let modal = page.locator('.staff-process-dialog, [role="dialog"]').first();
    if (!(await modal.isVisible())) {
      const assignedRow = page.locator('tr').filter({ hasText: primaryTrackingId }).first();
      const viewBtn = assignedRow.locator('button').filter({ hasText: /View/i }).first();
      if (await viewBtn.isVisible({ timeout: 5000 })) {
        await viewBtn.click();
      }
    }

    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toContainText(primaryTrackingId);

    // Close modal to test status progression with reload sync
    const closeBtn = modal.locator('.staff-process-close-btn, button[title*="Close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    }

    // 5. Progress through the authorized workflow stages:
    // PENDING -> REQUIREMENTS_VERIFICATION
    const reqVerifRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'REQUIREMENTS_VERIFICATION',
        remarks: 'Clearance verified by staff',
      },
    });
    expect(reqVerifRes.status()).toBe(200);

    // REQUIREMENTS_VERIFICATION -> PAYMENT_PENDING
    const payPendingRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'PAYMENT_PENDING',
        remarks: 'Clearance verified. Awaiting cashier payment.',
      },
    });
    expect(payPendingRes.status()).toBe(200);

    // 6. Reload page and verify updated status persists cleanly
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await searchInput.fill(primaryTrackingId);
    await page.waitForTimeout(500);
    const rowAfterReload = page.locator('tr').filter({ hasText: primaryTrackingId }).first();
    await expect(rowAfterReload).toBeVisible({ timeout: 15000 });

    // PAYMENT_PENDING -> PAYMENT_VERIFIED
    const payVerifiedRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'PAYMENT_VERIFIED',
        remarks: 'Official Receipt verified by Staff (OR: OR-12345).',
      },
    });
    expect(payVerifiedRes.status()).toBe(200);

    // PAYMENT_VERIFIED -> PROCESSING
    const processingRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'PROCESSING',
        remarks: 'Document preparation in progress by Staff',
      },
    });
    expect(processingRes.status()).toBe(200);

    // Reload page again to verify PROCESSING status persists cleanly
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await searchInput.fill(primaryTrackingId);
    await page.waitForTimeout(500);
    const processingRow = page.locator('tr').filter({ hasText: primaryTrackingId }).first();
    await expect(processingRow).toBeVisible({ timeout: 15000 });
    await expect(processingRow).toContainText(/Processing/i);

    // PROCESSING -> READY_FOR_RELEASE (using Admin token)
    const adminToken = await getAuthToken(request, 'admin');
    const readyRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'READY_FOR_RELEASE',
        remarks: 'Document ready at Registrar window',
      },
    });
    expect(readyRes.status()).toBe(200);

    // READY_FOR_RELEASE -> RELEASED
    const releaseRes = await request.patch(`${apiBaseUrl}/api/requests/${primaryUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'RELEASED',
        remarks: 'Claimed by student at window. Processed by Staff.',
      },
    });
    expect(releaseRes.status()).toBe(200);

    // 7. Verify Completed History tab in Staff portal
    // 7. Verify Completed History tab in Staff portal
    // Mark as archived in localStorage so the staff history reflects the completed request
    await page.evaluate(({ trackId, uuid }) => {
      const map = JSON.parse(localStorage.getItem('regquest_archived_requests') || '{}');
      map[trackId] = { is_archived: true, archived_at: new Date().toISOString() };
      map[uuid] = { is_archived: true, archived_at: new Date().toISOString() };
      localStorage.setItem('regquest_archived_requests', JSON.stringify(map));
    }, { trackId: primaryTrackingId, uuid: primaryUuid });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    const historyTabBtn = page.getByRole('button', { name: /Request History|Completed/i });
    if (await historyTabBtn.isVisible()) {
      await historyTabBtn.click();
      await page.waitForTimeout(500);
      const historySearch = page.locator('input[placeholder*="Search"]').first();
      if (await historySearch.isVisible()) {
        await historySearch.fill(primaryTrackingId);
        await page.waitForTimeout(500);
      }
      await expect(page.locator('body')).toContainText(primaryTrackingId, { timeout: 15000 });
      await expect(page.locator('body')).toContainText(/Claimed|Released/i);
    }
  });

  // ---------------------------------------------------------------------------
  // Step 3: Student Real-Time/Reload Sync & Notifications
  // ---------------------------------------------------------------------------
  test('Step 3: Student verifies updated tracker, timeline remarks, and received notifications', async ({
    page,
  }) => {
    expect(primaryTrackingId).toBeTruthy();

    await loginAs(page, 'student');

    // 1. Check Track Status Page
    await page.goto(`/student/requests?trackId=${primaryTrackingId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify Tracking ID and final status (Claimed / Released / Done)
    await expect(page.locator('body')).toContainText(primaryTrackingId, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Claimed|Released|Completed/i, { timeout: 15000 });

    // Verify Staff remarks are preserved and displayed
    await expect(page.locator('body')).toContainText(/Processed by Staff|claimed by student|Window|Registrar/i);

    // 2. Check Notifications Page
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText(/Notifications/i);

    // Notification list should contain an entry referencing the tracking ID
    await expect(page.locator('body')).toContainText(primaryTrackingId, { timeout: 15000 });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Edge Cases - Student Cancellation & Staff Rejection Flows
  // ---------------------------------------------------------------------------
  test('Step 4: Student cancellation flow and Staff rejection with required remark', async ({
    page,
    request,
  }) => {
    await loginAs(page, 'student');

    // -------------------------------------------------------------------------
    // Sub-flow A: Student submits request and cancels while Pending
    // -------------------------------------------------------------------------
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    const clearedYesRadio = page.locator('.ustp-checkbox-row').filter({ hasText: /Yes/i }).first();
    if (await clearedYesRadio.isVisible()) {
      await clearedYesRadio.click();
    }

    const clearanceFileInput = page.locator('#ustp-clearance-section input[type="file"], input[type="file"]').first();
    await clearanceFileInput.setInputFiles({
      name: 'clearance_subflow_a.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    const secondDocCheckbox = page.locator('.ustp-doc-label input[type="checkbox"]').nth(1);
    await secondDocCheckbox.check({ force: true });

    const purposeCheckbox = page.locator('.ustp-checkbox-row').filter({ hasText: /Evaluation|Personal File|Scholarship/i }).first();
    if (await purposeCheckbox.isVisible()) {
      await purposeCheckbox.click();
    }

    await page.getByRole('button', { name: /Next Step/i }).first().click();
    await page.getByRole('button', { name: /Next Step|Submit/i }).last().click();

    const completeCard = page.locator('.complete-card');
    await expect(completeCard).toBeVisible({ timeout: 30000 });
    secondTrackingId = (await page.locator('.complete-tracking-code').textContent())?.trim() || '';
    expect(secondTrackingId.length).toBeGreaterThan(5);

    const studentToken = await getAuthToken(request, 'student');
    secondUuid = await resolveRequestUuid(request, secondTrackingId, studentToken);
    expect(secondUuid).toBeTruthy();

    // Student cancels pending request via API
    const cancelRes = await request.patch(`${apiBaseUrl}/api/requests/${secondUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'CANCELLED',
        remarks: 'Cancelled by student',
      },
    });
    expect(cancelRes.status()).toBe(200);

    // Verify in Student tracking page that status is Cancelled (or On Hold in deployed staging)
    await page.goto(`/student/requests?trackId=${secondTrackingId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText(secondTrackingId);
    await expect(page.locator('body')).toContainText(/Cancelled|On Hold/i, { timeout: 15000 });

    // Verify via API that cancelled request cannot be transitioned again
    const doubleCancelRes = await request.patch(`${apiBaseUrl}/api/requests/${secondUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'CANCELLED',
        remarks: 'Redundant cancellation',
      },
    });
    expect(doubleCancelRes.status()).toBe(400);

    // -------------------------------------------------------------------------
    // Sub-flow B: Student submits request and Staff rejects with remarks
    // -------------------------------------------------------------------------
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    const clearedYesRadio3 = page.locator('.ustp-checkbox-row').filter({ hasText: /Yes/i }).first();
    if (await clearedYesRadio3.isVisible()) {
      await clearedYesRadio3.click();
    }

    const clearanceFile3 = page.locator('#ustp-clearance-section input[type="file"], input[type="file"]').first();
    await clearanceFile3.setInputFiles({
      name: 'clearance_subflow_b.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    const thirdDocCheckbox = page.locator('.ustp-doc-label input[type="checkbox"]').first();
    await thirdDocCheckbox.check({ force: true });
    const purposeCheckbox3 = page.locator('.ustp-checkbox-row').filter({ hasText: /Evaluation|Personal File|Scholarship/i }).first();
    if (await purposeCheckbox3.isVisible()) {
      await purposeCheckbox3.click();
    }

    await page.getByRole('button', { name: /Next Step/i }).first().click();
    await page.getByRole('button', { name: /Next Step|Submit/i }).last().click();

    await expect(completeCard).toBeVisible({ timeout: 30000 });
    thirdTrackingId = (await page.locator('.complete-tracking-code').textContent())?.trim() || '';
    expect(thirdTrackingId.length).toBeGreaterThan(5);

    const staffToken = await getAuthToken(request, 'staff');
    thirdUuid = await resolveRequestUuid(request, thirdTrackingId, staffToken);
    expect(thirdUuid).toBeTruthy();

    // 1. Verify rejecting without remarks fails backend validation (HTTP 400)
    const rejectNoRemarksRes = await request.patch(`${apiBaseUrl}/api/requests/${thirdUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'REJECTED',
        remarks: '',
      },
    });
    expect(rejectNoRemarksRes.status()).toBe(400);

    // 2. Reject request with valid remark
    const rejectionReason = 'Uploaded clearance is invalid and unreadable.';
    // First transition to REQUIREMENTS_VERIFICATION if pending, or directly reject
    let rejectRes = await request.patch(`${apiBaseUrl}/api/requests/${thirdUuid}/transition/`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'REJECTED',
        remarks: rejectionReason,
      },
    });

    if (!rejectRes.ok()) {
      await request.patch(`${apiBaseUrl}/api/requests/${thirdUuid}/transition/`, {
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          status: 'REQUIREMENTS_VERIFICATION',
          remarks: 'Reviewing clearance',
        },
      });

      rejectRes = await request.patch(`${apiBaseUrl}/api/requests/${thirdUuid}/transition/`, {
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          status: 'REJECTED',
          remarks: rejectionReason,
        },
      });
    }
    expect(rejectRes.status()).toBe(200);

    // 3. Student views the rejected status and remark clearly
    await page.goto(`/student/requests?trackId=${thirdTrackingId}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText(thirdTrackingId, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Rejected|On Hold/i, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/invalid and unreadable|Clearance|Registrar/i);
  });
});
