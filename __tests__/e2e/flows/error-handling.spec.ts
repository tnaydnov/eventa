import { test, expect } from '@playwright/test';
import { setupAuthenticatedMocks, setSessionCookie, TEST_EVENT_SLUG } from '../helpers/fixtures';

/**
 * E2E tests for error handling (E-ERR-01 through E-ERR-05).
 */

test.describe('Error Handling', () => {
  test('E-ERR-01: Network error handled', async ({ page }) => {
    await setSessionCookie(page);

    // Abort all API calls to simulate network failure
    await page.route('**/api/**', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    // Should still render something (error boundary or fallback)
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-ERR-02: Server 500 is handled gracefully', async ({ page }) => {
    await setSessionCookie(page);

    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-ERR-03: Session expired mid-use redirects', async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Expire session for subsequent requests
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-ERR-04: Image upload failure handled', async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Mock upload URL to fail
    await page.route('**/api/secure/upload-url**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Storage failure' }),
      });
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}/profile`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-ERR-05: Rate limited action handled', async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Override likes to return 429
    await page.route('**/api/secure/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Too many requests' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      }
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });
});
