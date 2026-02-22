/**
 * Unit tests for lib/device-fingerprint.ts - Device identification
 * Tests: U-DFP-01 through U-DFP-07+
 *
 * Uses jsdom environment for browser APIs (canvas, navigator, etc.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDeviceFingerprint, getDeviceIdentifiers } from '@/lib/device-fingerprint';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
  // Mock crypto.randomUUID
  vi.stubGlobal('crypto', {
    ...globalThis.crypto,
    randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
    subtle: {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    },
  });
});

describe('generateDeviceFingerprint', () => {
  it('U-DFP-01: returns a string', async () => {
    const result = await generateDeviceFingerprint();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('U-DFP-02: returns consistent results for same environment', async () => {
    const result1 = await generateDeviceFingerprint();
    const result2 = await generateDeviceFingerprint();
    expect(result1).toBe(result2);
  });

  it('U-DFP-03: does not throw when canvas is unavailable', async () => {
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { getContext: () => null } as any;
      }
      return origCreate(tag);
    });
    await expect(generateDeviceFingerprint()).resolves.toBeDefined();
  });
});

describe('getDeviceIdentifiers', () => {
  it('U-DFP-04: returns object with localId and hardwareFingerprint', async () => {
    const result = await getDeviceIdentifiers();
    expect(result).toHaveProperty('localId');
    expect(result).toHaveProperty('hardwareFingerprint');
  });

  it('U-DFP-05: localId is a UUID', async () => {
    const result = await getDeviceIdentifiers();
    expect(result.localId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('U-DFP-06: persists localId in localStorage', async () => {
    await getDeviceIdentifiers();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'wedding_local_id',
      expect.any(String)
    );
  });

  it('U-DFP-07: reuses existing localId from localStorage', async () => {
    localStorageMock.getItem.mockReturnValueOnce('existing-uuid-from-storage');
    const result = await getDeviceIdentifiers();
    expect(result.localId).toBe('existing-uuid-from-storage');
  });

  it('hardwareFingerprint is a non-empty string', async () => {
    const result = await getDeviceIdentifiers();
    expect(typeof result.hardwareFingerprint).toBe('string');
    expect(result.hardwareFingerprint.length).toBeGreaterThan(0);
  });
});
