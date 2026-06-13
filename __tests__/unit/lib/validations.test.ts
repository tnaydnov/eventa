/**
 * Unit tests for lib/validations.ts - Zod schemas & image validation
 * Tests: U-VAL-01 through U-VAL-47+
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  profileSetupSchema,
  adminLoginSchema,
  createEventSchema,
  updateEventSchema,
  sendMessageSchema,
  joinEventSchema,
  photoReorderSchema,
  likeSeenSchema,
  getEffectiveImageType,
  validateImageFile,
  validateImageMagicBytes,
  genderValues,
  attractedToValues,
  lookingForValues,
  messageTypeValues,
  eventTypeValues,
  eventStatusValues,
} from '@/lib/validations';

/* ==========  Enum values  ========== */

describe('enum value arrays', () => {
  it('U-VAL-01: genderValues contains exactly male, female, other', () => {
    expect([...genderValues]).toEqual(['male', 'female', 'other']);
  });

  it('U-VAL-02: attractedToValues contains men, women, all', () => {
    expect([...attractedToValues]).toEqual(['men', 'women', 'all']);
  });

  it('U-VAL-03: lookingForValues has 4 items', () => {
    expect(lookingForValues.length).toBe(4);
    expect([...lookingForValues]).toContain('serious');
    expect([...lookingForValues]).toContain('casual');
    expect([...lookingForValues]).toContain('friends');
    expect([...lookingForValues]).toContain('figuring_out');
  });

  it('U-VAL-04: messageTypeValues has text and image', () => {
    expect([...messageTypeValues]).toEqual(['text', 'image']);
  });

  it('U-VAL-05: eventTypeValues has 4 entries', () => {
    expect(eventTypeValues.length).toBe(4);
    expect([...eventTypeValues]).toContain('wedding');
    expect([...eventTypeValues]).toContain('party');
  });

  it('eventStatusValues has 5 entries', () => {
    expect(eventStatusValues.length).toBe(5);
    expect([...eventStatusValues]).toContain('draft');
    expect([...eventStatusValues]).toContain('archived');
  });
});

/* ==========  profileSetupSchema  ========== */

describe('profileSetupSchema', () => {
  const validProfile = {
    display_name: 'John',
    gender: 'male' as const,
    attracted_to: 'women' as const,
    age: 25,
  };

  it('U-VAL-06: accepts valid minimal profile', () => {
    const result = profileSetupSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it('U-VAL-07: accepts full profile with all optional fields', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      bio: 'Hello world',
      city: 'Tel Aviv',
      looking_for: 'serious',
    });
    expect(result.success).toBe(true);
  });

  it('U-VAL-08: trims display_name', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      display_name: '  Alice  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.display_name).toBe('Alice');
  });

  it('U-VAL-09: rejects empty display_name', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      display_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-10: rejects whitespace-only display_name', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      display_name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-11: rejects display_name over 30 chars', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      display_name: 'A'.repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-12: rejects invalid gender', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      gender: 'robot',
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-13: rejects invalid attracted_to', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      attracted_to: 'robots',
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-14: rejects age < 18', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      age: 17,
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-15: rejects age > 120', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      age: 121,
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-16: rejects non-integer age', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      age: 25.5,
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-17: rejects bio over 200 chars', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      bio: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-18: transforms empty bio to null', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      bio: '  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bio).toBeNull();
  });

  it('U-VAL-19: allows null bio', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      bio: null,
    });
    expect(result.success).toBe(true);
  });

  it('U-VAL-20: rejects city over 50 chars', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      city: 'x'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('U-VAL-21: transforms empty city to null', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      city: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.city).toBeNull();
  });

  it('allows valid looking_for', () => {
    for (const lf of lookingForValues) {
      const result = profileSetupSchema.safeParse({
        ...validProfile,
        looking_for: lf,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid looking_for', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      looking_for: 'adventure',
    });
    expect(result.success).toBe(false);
  });

  it('accepts age exactly 18', () => {
    const result = profileSetupSchema.safeParse({ ...validProfile, age: 18 });
    expect(result.success).toBe(true);
  });

  it('accepts age exactly 120', () => {
    const result = profileSetupSchema.safeParse({ ...validProfile, age: 120 });
    expect(result.success).toBe(true);
  });

  it('rejects missing age', () => {
    const { age, ...noAge } = validProfile;
    const result = profileSetupSchema.safeParse(noAge);
    expect(result.success).toBe(false);
  });

  it('accepts display_name exactly 30 chars', () => {
    const result = profileSetupSchema.safeParse({
      ...validProfile,
      display_name: 'A'.repeat(30),
    });
    expect(result.success).toBe(true);
  });
});

/* ==========  adminLoginSchema  ========== */

describe('adminLoginSchema', () => {
  it('U-VAL-22: accepts valid password', () => {
    expect(adminLoginSchema.safeParse({ password: 'supersecure123' }).success).toBe(true);
  });

  it('U-VAL-23: rejects empty password', () => {
    expect(adminLoginSchema.safeParse({ password: '' }).success).toBe(false);
  });

  it('rejects missing password', () => {
    expect(adminLoginSchema.safeParse({}).success).toBe(false);
  });
});

/* ==========  createEventSchema  ========== */

describe('createEventSchema', () => {
  const validEvent = {
    name: 'My Wedding',
    slug: 'my-wedding',
    event_type: 'wedding' as const,
  };

  it('U-VAL-24: accepts valid event', () => {
    expect(createEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('U-VAL-25: rejects empty name', () => {
    expect(createEventSchema.safeParse({ ...validEvent, name: '' }).success).toBe(false);
  });

  it('U-VAL-26: rejects name over 100 chars', () => {
    expect(createEventSchema.safeParse({ ...validEvent, name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('U-VAL-27: rejects slug with uppercase', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: 'My-Event' }).success).toBe(false);
  });

  it('U-VAL-28: rejects slug with spaces', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: 'my event' }).success).toBe(false);
  });

  it('U-VAL-29: rejects slug with special chars', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: 'my_event!' }).success).toBe(false);
  });

  it('U-VAL-30: accepts slug with numbers and hyphens', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: 'event-2024-jan' }).success).toBe(true);
  });

  it('U-VAL-31: rejects invalid event_type', () => {
    expect(createEventSchema.safeParse({ ...validEvent, event_type: 'gala' }).success).toBe(false);
  });

  it('accepts all valid event types', () => {
    for (const t of eventTypeValues) {
      expect(createEventSchema.safeParse({ ...validEvent, event_type: t }).success).toBe(true);
    }
  });

  it('accepts optional description', () => {
    expect(createEventSchema.safeParse({ ...validEvent, description: 'A nice event' }).success).toBe(true);
  });

  it('rejects description over 500 chars', () => {
    expect(createEventSchema.safeParse({ ...validEvent, description: 'x'.repeat(501) }).success).toBe(false);
  });

  it('accepts optional datetime fields', () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      starts_at: '2024-12-01T18:00:00.000Z',
      ends_at: '2024-12-02T02:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid datetime', () => {
    expect(createEventSchema.safeParse({ ...validEvent, starts_at: 'not-a-date' }).success).toBe(false);
  });

  it('rejects empty slug', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: '' }).success).toBe(false);
  });

  it('rejects slug over 50 chars', () => {
    expect(createEventSchema.safeParse({ ...validEvent, slug: 'a'.repeat(51) }).success).toBe(false);
  });
});

/* ==========  updateEventSchema  ========== */

describe('updateEventSchema', () => {
  it('U-VAL-32: accepts valid update', () => {
    expect(updateEventSchema.safeParse({ name: 'Updated Name' }).success).toBe(true);
  });

  it('U-VAL-33: rejects archived status', () => {
    expect(updateEventSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('U-VAL-34: accepts active status', () => {
    expect(updateEventSchema.safeParse({ status: 'active' }).success).toBe(true);
  });

  it('accepts paused status', () => {
    expect(updateEventSchema.safeParse({ status: 'paused' }).success).toBe(true);
  });

  it('accepts ended status', () => {
    expect(updateEventSchema.safeParse({ status: 'ended' }).success).toBe(true);
  });

  it('accepts background_image URL', () => {
    expect(updateEventSchema.safeParse({ background_image: 'https://example.com/img.jpg' }).success).toBe(true);
  });

  it('accepts null background_image', () => {
    expect(updateEventSchema.safeParse({ background_image: null }).success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    expect(updateEventSchema.safeParse({}).success).toBe(true);
  });
});

/* ==========  sendMessageSchema  ========== */

describe('sendMessageSchema', () => {
  const validMsg = {
    conversationId: '550e8400-e29b-41d4-a716-446655440000',
    text: 'hello',
  };

  it('U-VAL-35: accepts valid message', () => {
    expect(sendMessageSchema.safeParse(validMsg).success).toBe(true);
  });

  it('U-VAL-36: rejects invalid conversationId', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, conversationId: 'not-uuid' }).success).toBe(false);
  });

  it('U-VAL-37: rejects message over 2000 chars', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, text: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('accepts exactly 2000 chars', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, text: 'x'.repeat(2000) }).success).toBe(true);
  });

  it('defaults type to text', () => {
    const result = sendMessageSchema.safeParse(validMsg);
    if (result.success) expect(result.data.type).toBe('text');
  });

  it('accepts image type', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, type: 'image' }).success).toBe(true);
  });

  it('rejects invalid type', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, type: 'video' }).success).toBe(false);
  });

  it('accepts optional mediaPath', () => {
    expect(sendMessageSchema.safeParse({ ...validMsg, mediaPath: 'path/to/file.jpg' }).success).toBe(true);
  });
});

/* ==========  joinEventSchema  ========== */

describe('joinEventSchema', () => {
  it('U-VAL-38: accepts valid join', () => {
    expect(joinEventSchema.safeParse({ eventSlug: 'my-event', joinCode: 'abc123' }).success).toBe(true);
  });

  it('U-VAL-39: accepts a short joinCode (join codes are now optional/legacy)', () => {
    // Join codes were removed from the product; joinCode is now an optional,
    // length-capped legacy field with no minimum length.
    expect(joinEventSchema.safeParse({ eventSlug: 'my-event', joinCode: 'ab' }).success).toBe(true);
  });

  it('rejects joinCode over 32 chars', () => {
    expect(joinEventSchema.safeParse({ eventSlug: 'e', joinCode: 'a'.repeat(33) }).success).toBe(false);
  });

  it('rejects empty eventSlug', () => {
    expect(joinEventSchema.safeParse({ eventSlug: '', joinCode: 'abc123' }).success).toBe(false);
  });
});

/* ==========  photoReorderSchema  ========== */

describe('photoReorderSchema', () => {
  it('U-VAL-40: accepts valid photo order', () => {
    const result = photoReorderSchema.safeParse({
      order: [
        { id: '550e8400-e29b-41d4-a716-446655440000', order_index: 0 },
        { id: '550e8400-e29b-41d4-a716-446655440001', order_index: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('U-VAL-41: rejects empty array', () => {
    expect(photoReorderSchema.safeParse({ order: [] }).success).toBe(false);
  });

  it('U-VAL-42: rejects array over 10 items', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      id: `550e8400-e29b-41d4-a716-44665544000${i.toString().padStart(1, '0')}`,
      order_index: i,
    }));
    expect(photoReorderSchema.safeParse({ order: items }).success).toBe(false);
  });

  it('rejects non-uuid id', () => {
    expect(photoReorderSchema.safeParse({
      order: [{ id: 'not-a-uuid', order_index: 0 }],
    }).success).toBe(false);
  });

  it('rejects negative order_index', () => {
    expect(photoReorderSchema.safeParse({
      order: [{ id: '550e8400-e29b-41d4-a716-446655440000', order_index: -1 }],
    }).success).toBe(false);
  });
});

/* ==========  likeSeenSchema  ========== */

describe('likeSeenSchema', () => {
  it('U-VAL-43: accepts fromParticipantId', () => {
    expect(likeSeenSchema.safeParse({ fromParticipantId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
  });

  it('U-VAL-44: accepts all=true', () => {
    expect(likeSeenSchema.safeParse({ all: true }).success).toBe(true);
  });

  it('U-VAL-45: rejects neither field', () => {
    expect(likeSeenSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid UUID for fromParticipantId', () => {
    expect(likeSeenSchema.safeParse({ fromParticipantId: 'not-uuid' }).success).toBe(false);
  });

  it('accepts both fields', () => {
    expect(likeSeenSchema.safeParse({
      fromParticipantId: '550e8400-e29b-41d4-a716-446655440000',
      all: true,
    }).success).toBe(true);
  });
});

/* ==========  getEffectiveImageType  ========== */

describe('getEffectiveImageType', () => {
  it('U-VAL-46: returns file.type when present', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    expect(getEffectiveImageType(file)).toBe('image/jpeg');
  });

  it('U-VAL-47: falls back to extension when type is empty', () => {
    const file = new File(['data'], 'photo.jpg', { type: '' });
    expect(getEffectiveImageType(file)).toBe('image/jpeg');
  });

  it('falls back to extension for application/octet-stream', () => {
    const file = new File(['data'], 'photo.png', { type: 'application/octet-stream' });
    expect(getEffectiveImageType(file)).toBe('image/png');
  });

  it('returns empty string for unknown extension', () => {
    const file = new File(['data'], 'file.xyz', { type: '' });
    expect(getEffectiveImageType(file)).toBe('');
  });

  it('handles webp extension', () => {
    const file = new File(['data'], 'photo.webp', { type: '' });
    expect(getEffectiveImageType(file)).toBe('image/webp');
  });

  it('returns empty for an unsupported heic extension (not in the allowlist)', () => {
    const file = new File(['data'], 'photo.heic', { type: '' });
    // HEIC is intentionally unsupported; getEffectiveImageType returns '' so
    // validateImageFile rejects it with the "images only" message.
    expect(getEffectiveImageType(file)).toBe('');
  });

  it('handles uppercase extension', () => {
    const file = new File(['data'], 'PHOTO.JPG', { type: '' });
    expect(getEffectiveImageType(file)).toBe('image/jpeg');
  });

  it('handles gif extension', () => {
    const file = new File(['data'], 'anim.gif', { type: '' });
    expect(getEffectiveImageType(file)).toBe('image/gif');
  });
});

/* ==========  validateImageFile  ========== */

describe('validateImageFile', () => {
  it('accepts valid jpeg', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file)).toBeNull();
  });

  it('accepts valid png', () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    expect(validateImageFile(file)).toBeNull();
  });

  it('accepts valid webp', () => {
    const file = new File(['data'], 'photo.webp', { type: 'image/webp' });
    expect(validateImageFile(file)).toBeNull();
  });

  it('accepts valid avif', () => {
    const file = new File(['data'], 'photo.avif', { type: 'image/avif' });
    expect(validateImageFile(file)).toBeNull();
  });

  it('rejects SVG files', () => {
    const file = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
    expect(validateImageFile(file)).toContain('SVG');
  });

  it('rejects SVG by extension even with wrong type', () => {
    const file = new File(['data'], 'icon.svg', { type: 'image/png' });
    expect(validateImageFile(file)).toContain('SVG');
  });

  it('rejects non-image files', () => {
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateImageFile(file)).toBeTruthy();
  });

  it('rejects files over 20MB', () => {
    // Create a file descriptor that claims large size
    const bigData = new Uint8Array(20 * 1024 * 1024 + 1);
    const file = new File([bigData], 'huge.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file)).toContain('20MB');
  });

  it('rejects disallowed image types', () => {
    const file = new File(['data'], 'photo.bmp', { type: 'image/bmp' });
    expect(validateImageFile(file)).toBeTruthy();
  });

  it('accepts valid gif', () => {
    const file = new File(['data'], 'anim.gif', { type: 'image/gif' });
    expect(validateImageFile(file)).toBeNull();
  });
});

/* ==========  validateImageMagicBytes  ========== */

describe('validateImageMagicBytes', () => {
  it('recognizes JPEG magic bytes', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateImageMagicBytes(bytes, 'image/jpeg')).toBe(true);
  });

  it('recognizes PNG magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateImageMagicBytes(bytes, 'image/png')).toBe(true);
  });

  it('recognizes GIF87a magic bytes', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(validateImageMagicBytes(bytes, 'image/gif')).toBe(true);
  });

  it('recognizes GIF89a magic bytes', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateImageMagicBytes(bytes, 'image/gif')).toBe(true);
  });

  it('recognizes WebP (RIFF) magic bytes', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    expect(validateImageMagicBytes(bytes, 'image/webp')).toBe(true);
  });

  it('rejects wrong magic bytes for JPEG', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG bytes
    expect(validateImageMagicBytes(bytes, 'image/jpeg')).toBe(false);
  });

  it('rejects wrong magic bytes for PNG', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG bytes
    expect(validateImageMagicBytes(bytes, 'image/png')).toBe(false);
  });

  it('allows AVIF (skips check)', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    expect(validateImageMagicBytes(bytes, 'image/avif')).toBe(true);
  });

  it('allows HEIC (skips check)', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    expect(validateImageMagicBytes(bytes, 'image/heic')).toBe(true);
  });

  it('allows HEIF (skips check)', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    expect(validateImageMagicBytes(bytes, 'image/heif')).toBe(true);
  });

  it('allows unknown types', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    expect(validateImageMagicBytes(bytes, 'image/tiff')).toBe(true);
  });
});
