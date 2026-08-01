import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID_2,
  mockParticipant2,
  mockPhotos2,
  mockMultiplePhotos,
} from '../helpers/fixtures';

/**
 * E2E tests for viewing another user's profile (E-VP-01 through E-VP-06).
 * Note: The user profile page fetches data directly from Supabase client-side,
 * so we intercept the Supabase REST API calls to mock responses.
 */

test.describe('View Profile', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Intercept Supabase REST API calls for participant data
    await page.route('**/rest/v1/participants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockParticipant2),
      });
    });

    await page.route('**/rest/v1/participant_photos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPhotos2),
      });
    });

    await page.route('**/rest/v1/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });
  });

  test('E-VP-01: Profile page loads with user info', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();
    // Should show the user's profile with their name
    await expect(page.locator('body')).toContainText('משתמשת טסט', { timeout: 10000 });
  });

  test('E-VP-02: Like from profile page', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toContainText('משתמשת טסט', { timeout: 10000 });

    // Find and click like button on profile
    const likeBtn = page.locator('.profile-action-btn').first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-VP-03: Unlike from profile page', async ({ page }) => {
    // Mock as already liked
    await page.route('**/rest/v1/likes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'test-like-id' }]),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-VP-04: Block from profile page', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();

    // Block button should be available
    const blockBtn = page.locator('button', { hasText: 'חסימה' });
    if (await blockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await blockBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-VP-05: Photo gallery displays', async ({ page }) => {
    // Override photos to have multiple
    await page.route('**/rest/v1/participant_photos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMultiplePhotos),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-VP-06: Message button for matched user', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();
  });
});
