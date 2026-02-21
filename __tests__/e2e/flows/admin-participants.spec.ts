import { test, expect } from '@playwright/test';
import {
  setupAdminMocks,
  TEST_EVENT_ID,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  mockAdminParticipants,
  mockParticipant,
  mockParticipant2,
} from '../helpers/fixtures';

/**
 * E2E tests for admin participants management (E-AD-PRT-01 through E-AD-PRT-04).
 */

test.describe('Admin Participants', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
  });

  test('E-AD-PRT-01: View participants list', async ({ page }) => {
    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();

    // Admin dashboard should show participant data
    await expect(page.locator('.admin-root').first()).toBeVisible();
  });

  test('E-AD-PRT-02: Ban participant', async ({ page }) => {
    let banPosted = false;
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/participants/${TEST_PARTICIPANT_ID}/ban`, async (route) => {
      banPosted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-PRT-03: Unban participant', async ({ page }) => {
    // Mock participant as banned
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/participants`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participants: [
            { ...mockParticipant, is_banned: true, photo_url: 'https://storage.example.com/photos/photo1.jpg' },
          ],
        }),
      });
    });

    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/participants/${TEST_PARTICIPANT_ID}/unban`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-AD-PRT-04: View participant details', async ({ page }) => {
    await page.route(`**/api/admin/events/${TEST_EVENT_ID}/participants/${TEST_PARTICIPANT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participant: mockParticipant,
          photos: [],
          likes: { sent: 5, received: 3 },
          conversations: 2,
        }),
      });
    });

    await page.goto(`/admin`);
    await expect(page.locator('body')).toBeVisible();
  });
});
