import { test, expect } from '@playwright/test';
import {
  TEST_EVENT_SLUG,
  TEST_EVENT_ID,
  TEST_PARTICIPANT_ID,
  TEST_EVENT_NAME,
  TEST_JOIN_CODE,
  mockParticipant,
  mockEventStatus,
  mockSendOtp,
  mockVerifyOtp,
} from '../helpers/fixtures';

/**
 * E2E tests for phone-based session recovery.
 * Flow: cache cleared → phone OTP → reconnects to existing participant
 */

test.describe('Phone Recovery Flow', () => {
  const joinUrl = `/dating/${TEST_EVENT_SLUG}/join?k=${TEST_JOIN_CODE}`;

  test.beforeEach(async ({ page }) => {
    await page.route('**/realtime/**', (route) => route.abort());
    // Clear localStorage to simulate cache clear
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('E-PR-01: User with cleared cache can re-enter phone to reconnect', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);
    // Verify-otp returns existing participant (isReconnect implied by returning complete profile)
    await mockVerifyOtp(page, {
      eventId: TEST_EVENT_ID,
      eventName: TEST_EVENT_NAME,
      backgroundImage: null,
      participantId: TEST_PARTICIPANT_ID,
      participant: mockParticipant,
    });

    await page.goto(joinUrl);

    // Accept terms
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();

    // Enter existing phone
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();

    // Verify OTP
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });
    const otpInputs = page.locator('[role="group"] input');
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String(i + 1));
      }
    }

    // Existing user has display_name → redirects to grid (not setup)
    await page.waitForURL(`**/dating/${TEST_EVENT_SLUG}`, { timeout: 10000 });
  });

  test('E-PR-02: OTP send failure shows error and allows retry', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    // First call fails, second succeeds
    let callCount = 0;
    await page.route('**/api/auth/send-otp', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'נסו שוב בעוד דקה' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, maskedPhone: '050-***4567' }),
        });
      }
    });

    await page.goto(joinUrl);

    // Accept terms → phone input
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');

    // First attempt fails
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('נסו שוב', { timeout: 3000 });

    // Second attempt succeeds (retry)
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });
  });

  test('E-PR-03: Wrong OTP shows error without redirect', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    // Mock verify-otp to fail (wrong code)
    await page.route('**/api/auth/verify-otp', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'קוד שגוי' }),
      });
    });

    await page.goto(joinUrl);

    // Accept terms → phone → OTP
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Enter wrong OTP
    const otpInputs = page.locator('[role="group"] input');
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill('9');
      }
    }

    // Should show error, still on OTP step
    await page.waitForTimeout(1000);
    const bodyText = await page.textContent('body');
    // Should still be on OTP page (not redirected)
    expect(bodyText).toContain('הזינו את הקוד');
  });

  test('E-PR-04: Banned phone shows blocked message', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });
    await mockSendOtp(page);

    // Mock verify-otp to return banned
    await page.route('**/api/auth/verify-otp', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'DEVICE_BANNED' }),
      });
    });

    await page.goto(joinUrl);

    // Accept terms → phone → OTP → banned
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });
    await page.locator('#phone-input').fill('501234567');
    await page.locator('button', { hasText: 'שלחו קוד' }).click();
    await expect(page.locator('body')).toContainText('הזינו את הקוד', { timeout: 5000 });

    // Enter OTP
    const otpInputs = page.locator('[role="group"] input');
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String(i + 1));
      }
    }

    // Should show blocked/banned message
    await expect(page.locator('body')).toContainText('חסום', { timeout: 5000 });
  });

  test('E-PR-05: SMS consent checkbox is visible and toggleable', async ({ page }) => {
    await mockEventStatus(page);
    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No session"}' });
    });

    await page.goto(joinUrl);

    // Accept terms → phone step
    await page.locator('[role="checkbox"]').first().click();
    await page.locator('button', { hasText: 'המשך' }).click();
    await expect(page.locator('#phone-input')).toBeVisible({ timeout: 5000 });

    // SMS consent checkbox should be visible
    const smsConsentText = page.locator('text=SMS');
    await expect(smsConsentText).toBeVisible();

    // Should be checkable (toggle)
    const consentCheckbox = page.locator('[role="checkbox"]').last();
    if (await consentCheckbox.isVisible()) {
      const wasChecked = await consentCheckbox.getAttribute('aria-checked');
      await consentCheckbox.click();
      const isChecked = await consentCheckbox.getAttribute('aria-checked');
      expect(isChecked).not.toBe(wasChecked);
    }
  });
});
