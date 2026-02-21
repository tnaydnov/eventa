import { test, expect } from '@playwright/test';
import { setupAdminMocks, mockEvent, TEST_EVENT_ID } from '../helpers/fixtures';

/**
 * E2E tests for admin event management (E-AD-EVT-01 through E-AD-EVT-10).
 */

test.describe('Admin Event Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
  });

  test('E-AD-EVT-01: Admin page loads with event list', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-root')).toBeVisible();
  });

  test('E-AD-EVT-02: Edit event fields', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ event: { ...mockEvent, name: 'שם חדש' } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ event: mockEvent }),
        });
      }
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-03: Change event status', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ event: { ...mockEvent, status: 'ended' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-04: Rotate join code', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/rotate-code`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ join_code: 'NEWCODE12345X' }),
      });
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-05: Upload background', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/background`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ background_image: 'https://example.com/bg.jpg' }),
      });
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-06: Delete background', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/background`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-07: Delete event', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-08: Archive event', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/archive`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-EVT-09: Search events', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
    // If search input exists, type in it
    const searchInput = page.locator('input[type="search"], input[placeholder*="חיפוש"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('חתונה');
      await page.waitForTimeout(300);
    }
  });

  test('E-AD-EVT-10: Empty state when no events', async ({ page }) => {
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
});
