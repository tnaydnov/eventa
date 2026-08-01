import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['__tests__/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/**', 'src/hooks/**'],
      exclude: ['src/lib/stores/**'],
    },
    // Separate server-side tests that need Node environment
    environmentMatchGlobs: [
      ['__tests__/unit/lib/session.test.ts', 'node'],
      ['__tests__/unit/lib/admin-auth.test.ts', 'node'],
      ['__tests__/unit/lib/rate-limit.test.ts', 'node'],
      ['__tests__/unit/lib/route-helpers.test.ts', 'node'],
      ['__tests__/unit/lib/supabase.test.ts', 'node'],
      ['__tests__/unit/lib/logger.test.ts', 'node'],
      ['__tests__/unit/lib/phone-utils.test.ts', 'node'],
      ['__tests__/unit/lib/otp.test.ts', 'node'],
      ['__tests__/unit/lib/guest-upload.test.ts', 'node'],
      ['__tests__/unit/lib/security-attacks.test.ts', 'node'],
      ['__tests__/unit/lib/messaging/**', 'node'],
      ['__tests__/integration/**', 'node'],
    ],
  },
});
