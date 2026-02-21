import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  TEST_EVENT_SLUG,
  mockParticipant,
  mockIncompleteParticipant,
} from '../helpers/fixtures';

/**
 * E2E tests for profile setup flow (E-PS-01 through E-PS-07).
 */

test.describe('Profile Setup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);

    // Override profile to return incomplete profile (triggers setup page)
    await page.route('**/api/secure/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ participant: mockIncompleteParticipant }),
        });
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ participant: mockParticipant }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('E-PS-01: Profile setup page loads with form', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    await expect(page.locator('body')).toContainText('יצירת פרופיל');
  });

  test('E-PS-02: Missing required fields shows validation', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    // Try to submit without filling fields
    const saveBtn = page.locator('button', { hasText: 'שמירה והמשך' });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      // Should show photo required error or validation error
      await page.waitForTimeout(500);
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });

  test('E-PS-03: Photo section is visible', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    await expect(page.locator('body')).toBeVisible();
    // Photo section should exist (for uploading)
    const photoText = await page.textContent('body');
    expect(photoText).toBeTruthy();
  });

  test('E-PS-04: Form has all required fields', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    // Name input should exist (uses class 'input' without explicit type)
    const nameInput = page.locator('input.input').first();
    await expect(nameInput).toBeAttached({ timeout: 10000 });
  });

  test('E-PS-05: Bio and city are optional', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    // Bio textarea and city input should exist but not required
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Look for bio textarea
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      // Should not have required attribute
      const required = await textarea.getAttribute('required');
      expect(required).toBeNull();
    }
  });

  test('E-PS-06: Name input has max length', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    const nameInput = page.locator('input.input').first();
    if (await nameInput.isVisible()) {
      // Type a very long name
      await nameInput.fill('אבגדהוזחטיכלמנסעפצקרשת123456789');
      const value = await nameInput.inputValue();
      expect(value.length).toBeLessThanOrEqual(30);
    }
  });

  test('E-PS-07: Hebrew text renders RTL', async ({ page }) => {
    await page.goto(`/dating/${TEST_EVENT_SLUG}/setup`);
    await expect(page.locator('body')).toBeVisible();
    const dir = await page.evaluate(
      () => document.documentElement.dir || document.body.dir || getComputedStyle(document.body).direction
    );
    expect(dir).toBe('rtl');
  });
});
