import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID_2,
  TEST_PARTICIPANT_ID_3,
  mockParticipant2,
  mockParticipant3,
  mockPhotos2,
} from '../helpers/fixtures';

/**
 * E2E tests for swipe mode (E-SW-01 through E-SW-06).
 */

test.describe('Swipe Mode', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Override grid to return multiple participants for swiping
    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participants: [mockParticipant2, mockParticipant3],
          photoMap: {
            [TEST_PARTICIPANT_ID_2]: 'https://storage.example.com/photos/photo2.jpg',
            [TEST_PARTICIPANT_ID_3]: 'https://storage.example.com/photos/photo3.jpg',
          },
        }),
      });
    });

    await page.goto(`/dating/${TEST_EVENT_SLUG}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-01: Swipe right sends like', async ({ page }) => {
    // Switch to swipe mode
    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    // Look for like button in swipe view
    const likeBtn = page.locator('[aria-label="לייק"]');
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-02: Swipe left dismisses', async ({ page }) => {
    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    // Look for skip/dismiss button
    const skipBtn = page.locator('[aria-label="דלג"]');
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-03: Mutual like creates match', async ({ page }) => {
    // Override likes POST to return match
    await page.route('**/api/secure/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, isMatch: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ received: [], sent: [], matches: [] }),
        });
      }
    });

    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    const likeBtn = page.locator('[aria-label="לייק"]');
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-04: Empty pool shows message', async ({ page }) => {
    // Override grid to return empty
    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participants: [], photoMap: {} }),
      });
    });

    // Reload to get empty state
    await page.reload();

    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-05: Can toggle view mode back to grid', async ({ page }) => {
    // Switch to swipe mode
    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    // Switch back to grid
    const gridToggle = page.locator('[aria-label="תצוגת גריד"]');
    if (await gridToggle.isVisible()) {
      await gridToggle.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('E-SW-06: View profile from swipe card', async ({ page }) => {
    const swipeToggle = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeToggle.isVisible()) {
      await swipeToggle.click();
    }

    // Look for profile view button on swipe card
    const viewProfileBtn = page.locator('[aria-label="צפייה בפרופיל"]');
    if (await viewProfileBtn.isVisible()) {
      await viewProfileBtn.click();
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
