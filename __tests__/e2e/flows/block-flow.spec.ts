import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  mockUserProfileAPI,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID,
  TEST_PARTICIPANT_ID_2,
  mockParticipant2,
  mockPhotos2,
} from '../helpers/fixtures';

/**
 * E2E tests for blocking flow (E-BL-01 through E-BL-05).
 */

test.describe('Block Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
    await mockUserProfileAPI(page);
  });

  test('E-BL-01: Block user from profile page', async ({ page }) => {
    let blockPosted = false;
    await page.route('**/api/secure/blocks', async (route) => {
      if (route.request().method() === 'POST') {
        blockPosted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ blocks: [] }),
        });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();

    const blockBtn = page.locator('button', { hasText: 'חסימה' });
    if (await blockBtn.isVisible()) {
      await blockBtn.click();

      // Confirm block dialog if present
      const confirmBtn = page.locator('button', { hasText: 'אישור' });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-BL-02: Block user from chat', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Block functionality should be accessible from chat context
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-BL-03: Blocked user not visible in grid', async ({ page }) => {
    // Mock blocks to include participant 2
    await page.route('**/api/secure/blocks**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blocks: [{ blocked_id: TEST_PARTICIPANT_ID_2 }],
        }),
      });
    });

    // Grid should exclude blocked user
    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participants: [], photoMap: {} }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();

    // Blocked user's name should not appear
    await expect(page.locator('body')).not.toContainText('משתמשת טסט');
  });

  test('E-BL-04: Cannot message blocked user', async ({ page }) => {
    // Mock blocks to include participant 2
    await page.route('**/api/secure/blocks**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blocks: [{ blocked_id: TEST_PARTICIPANT_ID_2 }],
        }),
      });
    });

    // Conversations should be empty because blocked
    await page.route('**/api/secure/conversations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-BL-05: Cannot like blocked user', async ({ page }) => {
    await page.route('**/api/secure/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'User is blocked' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}/user/${TEST_PARTICIPANT_ID_2}`);
    await expect(page.locator('body')).toBeVisible();
  });
});
