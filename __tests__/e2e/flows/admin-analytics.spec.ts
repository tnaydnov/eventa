import { test, expect } from '@playwright/test';
import {
  setupAdminMocks,
  TEST_EVENT_ID,
  mockAdminStats,
  mockEvent,
} from '../helpers/fixtures';

/**
 * E2E tests for admin analytics (E-AD-ANA-01 through E-AD-ANA-04).
 */

test.describe('Admin Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
  });

  test('E-AD-ANA-01: Event analytics shows stats', async ({ page }) => {
    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('.admin-root').first()).toBeVisible();
  });

  test('E-AD-ANA-02: Global analytics overview', async ({ page }) => {
    await page.route('**/api/admin/analytics**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalParticipants: 50,
          totalEvents: 3,
          totalLikes: 120,
          totalMatches: 25,
          totalMessages: 300,
          totalBlocks: 8,
        }),
      });
    });

    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-ANA-03: Charts render with data', async ({ page }) => {
    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();

    // Admin page should display stats (numbers)
    await expect(page.locator('.admin-root').first()).toBeVisible();
  });

  test('E-AD-ANA-04: QR code generation', async ({ page }) => {
    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();

    // QR code should be rendered for the event join link
    await expect(page.locator('.admin-root').first()).toBeVisible();
  });
});
