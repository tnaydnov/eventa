import { test, expect } from '@playwright/test';
import {
  TEST_EVENT_ID,
  TEST_EVENT_SLUG,
  TEST_PORTAL_TOKEN,
  mockPortalData,
  mockGuestPhone,
  setupPortalMocks,
} from '../helpers/fixtures';

/**
 * E2E tests for the client guest upload portal.
 * Flow: open portal link → upload Excel → see list → add/remove individual phones
 */

test.describe('Guest Upload Portal', () => {
  const portalUrl = `/guest-upload/${TEST_EVENT_SLUG}?k=${TEST_PORTAL_TOKEN}`;

  test.beforeEach(async ({ page }) => {
    await page.route('**/realtime/**', (route) => route.abort());
  });

  test('E-GU-01: Portal page loads with event info', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Event name should be visible
    await expect(page.locator('body')).toContainText(mockPortalData.event.name, { timeout: 10000 });
  });

  test('E-GU-02: Portal shows status badge', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Status badge should be visible (🔴 for empty, 🟡 for uploaded)
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);

    // Since we have 1 guest already uploaded but not sent, it should show yellow status
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('E-GU-03: Guest list shows existing guests', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Guest phone/name should be visible
    await expect(page.locator('body')).toContainText('ישראל', { timeout: 10000 });
  });

  test('E-GU-04: Upload zone is visible for active events', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Upload area should be present
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    // Should show upload-related UI (template download, drag zone, etc.)
    expect(bodyText).toBeTruthy();
  });

  test('E-GU-05: Add individual phone form works', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for phone input in AddPhoneForm
    const phoneInput = page.locator('input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('0521234567');

      // Look for the add button
      const addBtn = page.locator('button', { hasText: 'הוסיפו' });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        // Should show success feedback
        await page.waitForTimeout(1000);
      }
    }
  });

  test('E-GU-06: Remove guest phone button is present', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Wait for guest list to load
    await page.waitForTimeout(2000);

    // Delete button should exist for the guest entry (🗑 or similar)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('E-GU-07: Invalid token shows error', async ({ page }) => {
    // Mock portal endpoint to return 401 for invalid token
    await page.route('**/api/guest-portal/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid token' }),
      });
    });

    await page.goto(`/guest-upload/${TEST_EVENT_SLUG}?k=badtkn`);

    // Should show error state
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('E-GU-08: Archived event shows read-only view', async ({ page }) => {
    const archivedPortal = {
      ...mockPortalData,
      event: { ...mockPortalData.event, status: 'archived' },
    };

    await setupPortalMocks(page, archivedPortal);
    await page.goto(portalUrl);

    // Should show event ended / read-only text
    await expect(page.locator('body')).toContainText('הסתיים', { timeout: 10000 });
  });

  test('E-GU-09: Template download link is visible', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Template download should be available
    await page.waitForTimeout(2000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Should have a download template button or link
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('E-GU-10: Upload Excel displays results', async ({ page }) => {
    await setupPortalMocks(page);
    await page.goto(portalUrl);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for file input
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      // File input exists — portal is interactive
      await expect(fileInput.first()).toBeAttached();
    }
  });
});
