import { expect } from '@playwright/test';

export const credentials = {
  admin: {
    id: process.env.E2E_ADMIN_ID || process.env.ADMIN_ID || '2026100101',
    password: process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '2026100101',
  },
  registrar: {
    id: process.env.E2E_REGISTRAR_ID || process.env.REGISTRAR_ID || '1990100101',
    password: process.env.E2E_REGISTRAR_PASSWORD || process.env.REGISTRAR_PASSWORD || '1990100101',
  },
  staff: {
    id: process.env.E2E_STAFF_ID || process.env.STAFF_ID || '2000100101',
    password: process.env.E2E_STAFF_PASSWORD || process.env.STAFF_PASSWORD || '2000100101',
  },
  student: {
    id: process.env.E2E_STUDENT_ID || process.env.STUDENT_ID || '2023303431',
    password: process.env.E2E_STUDENT_PASSWORD || process.env.STUDENT_PASSWORD || '2023303431',
  },
};

export const apiBaseUrl = (
  process.env.E2E_API_URL || 'https://api.regquest.app'
).replace(/\/$/, '');

/**
 * Creates a minimal valid 1x1 transparent PNG buffer for receipt upload tests.
 */
export function createDummyPngBuffer() {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082',
    'hex'
  );
}

/**
 * Obtains JWT access & refresh tokens directly from DRF backend for API-level operations.
 */
export async function getAuthToken(request, role = 'student') {
  const creds = credentials[role];
  if (!creds || !creds.id) {
    throw new Error(`Missing test credentials for role: ${role}`);
  }

  const response = await request.post(`${apiBaseUrl}/api/auth/login/`, {
    data: {
      username: creds.id,
      password: creds.password,
    },
    timeout: 30000,
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to authenticate via API for ${role} (${creds.id}): ${response.status()} ${errorText}`
    );
  }

  const data = await response.json();
  return {
    access: data.access,
    refresh: data.refresh,
    user: data.user,
  };
}

/**
 * Performs full UI login using credentials from env.test.
 */
export async function loginAs(page, role) {
  const creds = credentials[role];
  if (!creds) {
    throw new Error(`Unknown role: ${role}`);
  }

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const idInput = page.locator('#username');
  const passwordInput = page.locator('#password');
  const submitButton = page.getByRole('button', { name: /Log In/i });

  await expect(idInput).toBeVisible({ timeout: 20000 });
  await idInput.fill(creds.id);
  await passwordInput.fill(creds.password);
  await submitButton.click();

  // Retry once if Render has a cold-start transient network error
  for (let attempt = 0; attempt < 2; attempt++) {
    const errorAlert = page.getByText(/Unable to connect to the authentication server/i);
    const hasError = await errorAlert.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (hasError) {
      await page.waitForTimeout(2000);
      await submitButton.click();
    } else {
      break;
    }
  }

  const expectedPath = role === 'student'
    ? '/student'
    : role === 'admin'
      ? '/admin'
      : role === 'registrar'
        ? '/registrar'
        : '/staff';

  await page.waitForURL(new RegExp(expectedPath), { timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Fast login by setting tokens directly in localStorage before navigating.
 */
export async function loginViaApiStorage(page, request, role) {
  const tokenData = await getAuthToken(request, role);
  await page.goto('/login');
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  }, tokenData);

  const destination = role === 'student'
    ? '/student/dashboard'
    : role === 'admin'
      ? '/admin/dashboard'
      : role === 'registrar'
        ? '/registrar/dashboard'
        : '/staff/dashboard';

  await page.goto(destination);
  await page.waitForLoadState('domcontentloaded');
  return tokenData;
}

/**
 * Performs logout in browser and waits for redirection to /login.
 */
export async function performLogout(page) {
  const visibleLogoutBtn = page.locator('button:has-text("Logout"), button[title="Logout"]').filter({ visible: true }).first();

  if (!(await visibleLogoutBtn.isVisible())) {
    const mobileToggle = page.locator('header button[title="Toggle Navigation Menu"]').filter({ visible: true });
    if (await mobileToggle.isVisible()) {
      const visibleAside = page.locator('aside').filter({ visible: true });
      if (!(await visibleAside.isVisible())) {
        await mobileToggle.click();
        await page.waitForTimeout(300);
      }
    }

    const profileBtn = page.locator('aside')
      .filter({ visible: true })
      .locator('button')
      .filter({ has: page.locator('svg path[d*="M12 12c2.21"]') })
      .first();

    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(300);
    }
  }

  const finalLogoutBtn = page.locator('button:has-text("Logout"), button[title="Logout"]').filter({ visible: true }).first();
  await expect(finalLogoutBtn).toBeVisible({ timeout: 15000 });
  await finalLogoutBtn.click();

  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Tracks created E2E test entities for clean teardown.
 */
export class E2ETestTracker {
  constructor(request, adminToken = null) {
    this.request = request;
    this.adminToken = adminToken;
    this.createdUserIds = [];
    this.createdRequestIds = [];
  }

  setAdminToken(token) {
    this.adminToken = token;
  }

  async createTemporaryUser(userData) {
    if (!this.adminToken) {
      const { access } = await getAuthToken(this.request, 'admin');
      this.adminToken = access;
    }

    const timestamp = Date.now();
    const payload = {
      username: `e2e_${timestamp}`,
      email: `e2e_${timestamp}@ustp.edu.ph`,
      first_name: 'E2E',
      last_name: `Test_${timestamp}`,
      role: 'staff',
      password: 'E2EPassword123!',
      is_active: true,
      ...userData,
    };

    const res = await this.request.post(`${apiBaseUrl}/api/users/`, {
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      data: payload,
    });

    if (!res.ok()) {
      throw new Error(`Failed to create temporary E2E user: ${res.status()} ${await res.text()}`);
    }

    const created = await res.json();
    this.createdUserIds.push(created.id);

    // Explicitly enforce is_active: false if requested (DRF create defaults to true)
    if (userData && userData.is_active === false) {
      await this.request.patch(`${apiBaseUrl}/api/users/${created.id}/`, {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        data: { is_active: false },
      });
      created.is_active = false;
    }

    return { ...created, plainPassword: payload.password };
  }

  async deleteTemporaryUser(userId) {
    if (!this.adminToken) {
      const { access } = await getAuthToken(this.request, 'admin');
      this.adminToken = access;
    }

    try {
      await this.request.delete(`${apiBaseUrl}/api/users/${userId}/`, {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
        },
      });
      this.createdUserIds = this.createdUserIds.filter((id) => id !== userId);
    } catch (e) {
      console.warn(`Failed to cleanup temporary user ${userId}:`, e);
    }
  }

  async cleanupAll() {
    if (!this.adminToken) {
      try {
        const { access } = await getAuthToken(this.request, 'admin');
        this.adminToken = access;
      } catch {}
    }

    if (this.adminToken) {
      for (const userId of [...this.createdUserIds]) {
        await this.deleteTemporaryUser(userId);
      }
    }
  }
}

/**
 * Helpers for reading & restoring registrar auto-approve setting.
 */
export async function getRegistrarSettings(request, registrarToken) {
  const res = await request.get(`${apiBaseUrl}/api/settings/registrar-approval/`, {
    headers: { Authorization: `Bearer ${registrarToken}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to fetch registrar settings: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

export async function setRegistrarAutoApprove(request, registrarToken, autoApprove) {
  const res = await request.patch(`${apiBaseUrl}/api/settings/registrar-approval/`, {
    headers: {
      Authorization: `Bearer ${registrarToken}`,
      'Content-Type': 'application/json',
    },
    data: { auto_approve_requests: autoApprove },
  });
  if (!res.ok()) {
    throw new Error(`Failed to update auto-approve setting: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

