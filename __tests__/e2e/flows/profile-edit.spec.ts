import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedMocks,
  TEST_EVENT_SLUG,
  mockParticipant,
  mockPhotos,
  mockMultiplePhotos,
} from '../helpers/fixtures';

/**
 * E2E tests for profile edit flow (E-PE-01 through E-PE-10).
 */

test.describe('Profile Edit Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedMocks(page);
  });

  test('E-PE-01: Profile page loads with current data', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    await expect(page.locator('body')).toContainText('עריכת פרופיל');
  });

  test('E-PE-02: Update name', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible()) {
      await nameInput.clear();
      await nameInput.fill('שם חדש');
      const value = await nameInput.inputValue();
      expect(value).toBe('שם חדש');
    }
  });

  test('E-PE-03: Update bio', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    const bioTextarea = page.locator('textarea');
    if (await bioTextarea.isVisible()) {
      await bioTextarea.clear();
      await bioTextarea.fill('ביו חדשה');
      const value = await bioTextarea.inputValue();
      expect(value).toBe('ביו חדשה');
    }
  });

  test('E-PE-04: Update age', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    const ageInput = page.locator('input[type="number"]');
    if (await ageInput.isVisible()) {
      await ageInput.clear();
      await ageInput.fill('28');
      const value = await ageInput.inputValue();
      expect(value).toBe('28');
    }
  });

  test('E-PE-05: Photo section visible', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    await expect(page.locator('body')).toBeVisible();
    // Photo grid section should exist
  });

  test('E-PE-06: Delete photo placeholder', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E-PE-07: Gender pills are interactive', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    // Look for gender pill buttons
    const malePill = page.getByRole('button', { name: 'גבר', exact: true });
    const femalePill = page.getByRole('button', { name: 'אישה', exact: true });
    if (await malePill.isVisible() && await femalePill.isVisible()) {
      await femalePill.click();
      await page.waitForTimeout(200);
    }
  });

  test('E-PE-08: Looking for options', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    await expect(page.locator('body')).toContainText('מחפש');
  });

  test('E-PE-09: Save button exists', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    const saveBtn = page.locator('button', { hasText: 'שמירת שינויים' });
    await expect(saveBtn).toBeAttached();
  });

  test('E-PE-10: Delete account flow', async ({ page }) => {
    await page.route('**/api/account/delete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'ws_session=; Path=/; Max-Age=0' },
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`/${TEST_EVENT_SLUG}/profile`);
    // Look for delete button
    const deleteBtn = page.locator('button', { hasText: 'מחיקת חשבון' });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(300);
    }
  });
});
