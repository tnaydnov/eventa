/**
 * Unit tests for lib/constants.ts - Domain constants, labels, and limits
 * Tests: U-CON-01 through U-CON-12+
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_PHOTOS,
  MAX_BACKGROUND_SIZE_BYTES,
  MAX_NAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_CITY_LENGTH,
  MAX_MESSAGE_LENGTH,
  RETENTION_DAYS,
  STORAGE_BATCH_SIZE,
  LOOKING_FOR_LABELS,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  EVENT_STATUS_LABELS,
} from '@/lib/constants';

describe('numeric limits', () => {
  it('U-CON-01: MAX_PHOTOS is 10', () => {
    expect(MAX_PHOTOS).toBe(10);
  });

  it('U-CON-02: MAX_BACKGROUND_SIZE_BYTES is 5 MB', () => {
    expect(MAX_BACKGROUND_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('U-CON-03: MAX_NAME_LENGTH is 30', () => {
    expect(MAX_NAME_LENGTH).toBe(30);
  });

  it('U-CON-04: MAX_BIO_LENGTH is 200', () => {
    expect(MAX_BIO_LENGTH).toBe(200);
  });

  it('U-CON-05: MAX_CITY_LENGTH is 50', () => {
    expect(MAX_CITY_LENGTH).toBe(50);
  });

  it('U-CON-06: MAX_MESSAGE_LENGTH is 2000', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(2000);
  });

  it('U-CON-07: RETENTION_DAYS is 7', () => {
    expect(RETENTION_DAYS).toBe(7);
  });

  it('U-CON-08: STORAGE_BATCH_SIZE is 100', () => {
    expect(STORAGE_BATCH_SIZE).toBe(100);
  });
});

describe('label maps', () => {
  it('U-CON-09: LOOKING_FOR_LABELS has 4 entries', () => {
    expect(Object.keys(LOOKING_FOR_LABELS)).toHaveLength(4);
    expect(LOOKING_FOR_LABELS).toHaveProperty('serious');
    expect(LOOKING_FOR_LABELS).toHaveProperty('casual');
    expect(LOOKING_FOR_LABELS).toHaveProperty('friends');
    expect(LOOKING_FOR_LABELS).toHaveProperty('figuring_out');
  });

  it('U-CON-10: EVENT_TYPE_LABELS has 7 entries', () => {
    expect(Object.keys(EVENT_TYPE_LABELS)).toHaveLength(7);
    expect(EVENT_TYPE_LABELS).toHaveProperty('wedding');
    expect(EVENT_TYPE_LABELS).toHaveProperty('party');
    expect(EVENT_TYPE_LABELS).toHaveProperty('corporate');
    expect(EVENT_TYPE_LABELS).toHaveProperty('meetup');
    expect(EVENT_TYPE_LABELS).toHaveProperty('other');
  });

  it('U-CON-11: EVENT_TYPE_ICONS has 7 entries', () => {
    expect(Object.keys(EVENT_TYPE_ICONS)).toHaveLength(7);
  });

  it('U-CON-12: EVENT_STATUS_LABELS has 5 entries', () => {
    expect(Object.keys(EVENT_STATUS_LABELS)).toHaveLength(5);
    expect(EVENT_STATUS_LABELS).toHaveProperty('draft');
    expect(EVENT_STATUS_LABELS).toHaveProperty('active');
    expect(EVENT_STATUS_LABELS).toHaveProperty('paused');
    expect(EVENT_STATUS_LABELS).toHaveProperty('ended');
    expect(EVENT_STATUS_LABELS).toHaveProperty('archived');
  });

  it('all label values are non-empty strings', () => {
    const allLabels = {
      ...LOOKING_FOR_LABELS,
      ...EVENT_TYPE_LABELS,
      ...EVENT_STATUS_LABELS,
    };
    for (const [key, value] of Object.entries(allLabels)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it('all icon values are non-empty strings', () => {
    for (const [key, value] of Object.entries(EVENT_TYPE_ICONS)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});
