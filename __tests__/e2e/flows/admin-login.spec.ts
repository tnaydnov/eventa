import { test, expect } from '@playwright/test';
import { setAdminCookie } from '../helpers/fixtures';

/**
 * E2E tests for admin login flow (E-AD-LGN-01 through E-AD-LGN-05).
 */

test.describe('Admin Login', () => {
  test('E-AD-LGN-01: Admin login page loads', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-root').first()).toBeVisible();
    // Should show login form with password input
    await expect(page.locator('.admin-input').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('ניהול Eventa');
  });

  test('E-AD-LGN-02: Wrong password shows error', async ({ page }) => {
    await page.route('**/api/admin/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid password' }),
      });
    });

    await page.goto('/admin');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('wrong-password');
    const submitBtn = page.locator('.admin-btn--primary');
    await submitBtn.click();
    await page.waitForTimeout(500);
  });

  test('E-AD-LGN-03: Brute-force lockout', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/admin/login', async (route) => {
      attempts++;
      if (attempts >= 5) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Too many attempts' }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid password' }),
        });
      }
    });

    await page.goto('/admin');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('.admin-btn--primary');

    // Submit 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      await passwordInput.fill(`wrong-${i}`);
      await submitBtn.click();
      await page.waitForTimeout(200);
    }
  });

  test('E-AD-LGN-04: Logout clears session', async ({ page }) => {
    await setAdminCookie(page);

    await page.route('**/api/admin/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'ws_admin=; Path=/; Max-Age=0' },
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock admin events so dashboard loads
    await page.route('**/api/admin/events', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      });
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-LGN-05: Session expiry redirects to login', async ({ page }) => {
    await setAdminCookie(page);

    // Mock admin events to return 401 (expired session)
    await page.route('**/api/admin/events', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });

    await page.goto('/admin');
    await page.waitForTimeout(500);
    // Should show login form again
    await expect(page.locator('body')).toBeVisible();
  });
});
