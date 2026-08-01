import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for tests that need them
process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-placeholder-value';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-placeholder-value';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.ADMIN_PASSWORD = 'test-admin-password-12345';
process.env.CRON_SECRET = 'test-cron-secret-1234567890';
process.env.NODE_ENV = 'test';

// Mock crypto.subtle for fingerprint tests in jsdom
if (!globalThis.crypto?.subtle) {
  // Node has crypto.subtle available natively in v20+
}

// Suppress console noise in tests
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
