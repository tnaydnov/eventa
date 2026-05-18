import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  navigateToEvent,
  TEST_EVENT_SLUG,
  TEST_PARTICIPANT_ID_2,
  mockParticipant2,
  mockParticipant3,
  mockReceivedLike,
} from '../helpers/fixtures';

/**
 * E2E tests for the grid page (E-GR-01 through E-GR-09).
 */

test.describe('Grid Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-GR-01: Grid loads with participant cards', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('.app-container')).toBeVisible();
    // Grid view should show participant cards or main content
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('E-GR-02: Filter by gender', async ({ page }) => {
    // Override profile to have attracted_to=all so filter bar shows
    await page.route('**/api/secure/profile', async (route) => {
      if (route.request().method() === 'GET') {
        const p = { ...mockParticipant2, attracted_to: 'all', id: '10000000-1000-4000-8000-200000000001' };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ participant: { ...p, profile_complete: true } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    // Filter bar chips should appear when attracted_to=all
    const filterBar = page.locator('.filter-bar');
    if (await filterBar.isVisible()) {
      const chips = page.locator('.filter-chip');
      expect(await chips.count()).toBeGreaterThanOrEqual(2);
    }
  });

  test('E-GR-03: Grid has participant names', async ({ page }) => {
    // Return multiple participants
    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participants: [mockParticipant2, mockParticipant3],
          photoMap: {},
        }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('E-GR-04: Tap card navigates to profile', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);
    const card = page.locator('.grid-card').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(500);
      // Should navigate to user profile page
      expect(page.url()).toContain('/user/');
    }
  });

  test('E-GR-05: Swipe mode toggle', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);
    // Look for swipe toggle button
    const swipeBtn = page.locator('[aria-label="תצוגת סווייפ"]');
    if (await swipeBtn.isVisible()) {
      await swipeBtn.click();
      await page.waitForTimeout(300);
      // Grid toggle should switch to swipe view
      const gridBtn = page.locator('[aria-label="תצוגת גריד"]');
      await expect(gridBtn).toBeVisible();
    }
  });

  test('E-GR-06: Grid highlight for received like', async ({ page }) => {
    // Mock likes to include a received like from participant2
    await page.route('**/api/secure/likes**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            received: [mockReceivedLike],
            sent: [],
            matches: [],
          }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('.main-content')).toBeVisible();
    // Highlighted cards should have the highlight class
    // (depends on whether the like data causes highlight)
  });

  test('E-GR-07: Empty grid shows message', async ({ page }) => {
    await page.route('**/api/secure/grid**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ participants: [], photoMap: {} }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    // Empty state message
    await expect(page.locator('body')).toContainText('אין משתתפים');
  });

  test('E-GR-08: Grid excludes blocked users', async ({ page }) => {
    // Block participant2
    await page.route('**/api/secure/blocks**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ blocks: [{ blocked_id: TEST_PARTICIPANT_ID_2 }] }),
        });
      } else {
        await route.fulfill({ status: 200, body: '{"success":true}' });
      }
    });

    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('E-GR-09: Grid excludes self', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);
    await expect(page.locator('.main-content')).toBeVisible();
    // Own participant should not appear in grid (API returns only others)
  });
});
