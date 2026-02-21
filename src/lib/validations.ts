import { z } from 'zod';
import {
  MAX_NAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_CITY_LENGTH,
  MAX_MESSAGE_LENGTH,
} from './constants';

/* ---- Env validation ---- */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

/** Validate environment variables at import time (server + client) */
export function validateEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (!result.success) {
    // Use console.error here intentionally — logger.ts may depend on env vars
    // that haven't been validated yet, risking a circular failure.
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
  }
  return result;
}

/* ---- Enum values ---- */
export const genderValues = ['male', 'female', 'other'] as const;
export const attractedToValues = ['men', 'women', 'all'] as const;
export const lookingForValues = ['serious', 'casual', 'friends', 'figuring_out'] as const;
export const messageTypeValues = ['text', 'image'] as const;
export const eventTypeValues = ['wedding', 'party', 'brit', 'bar_mitzvah', 'corporate', 'meetup', 'other'] as const;
export const eventStatusValues = ['draft', 'active', 'paused', 'ended', 'archived'] as const;

/* ---- Profile setup schema ---- */
export const profileSetupSchema = z.object({
  display_name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string()
      .min(1, 'נא להזין שם')
      .max(MAX_NAME_LENGTH, `שם ארוך מדי (עד ${MAX_NAME_LENGTH} תווים)`)
    ),
  gender: z.enum(genderValues, { message: 'נא לבחור מגדר' }),
  attracted_to: z.enum(attractedToValues, { message: 'נא לבחור העדפה' }),
  bio: z
    .string()
    .max(MAX_BIO_LENGTH, `ביו ארוך מדי (עד ${MAX_BIO_LENGTH} תווים)`)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
  age: z
    .number({ message: 'נא להזין גיל' })
    .int('גיל חייב להיות מספר שלם')
    .min(18, 'גיל מינימלי 18')
    .max(120, 'גיל לא תקין'),
  city: z
    .string()
    .max(MAX_CITY_LENGTH, 'שם עיר ארוך מדי')
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
  looking_for: z
    .enum(lookingForValues)
    .nullable()
    .optional(),
});

export type ProfileSetupData = z.infer<typeof profileSetupSchema>;

/* ---- Admin login schema ---- */
export const adminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

/* ---- Admin create event schema ---- */
export const createEventSchema = z.object({
  name: z.string().min(1, 'שם אירוע נדרש').max(100),
  slug: z
    .string()
    .min(1, 'slug נדרש')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'slug חייב להכיל רק אותיות קטנות, מספרים ומקפים'),
  event_type: z.enum(eventTypeValues).default('wedding'),
  description: z.string().max(500).nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

/* ---- Admin update event schema ---- */
// Exclude 'archived' — must go through the dedicated archive endpoint
const updateableStatusValues = eventStatusValues.filter((s) => s !== 'archived') as [string, ...string[]];
export const updateEventSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug חייב להכיל רק אותיות קטנות, מספרים ומקפים').optional(),
  event_type: z.enum(eventTypeValues).optional(),
  status: z.enum(updateableStatusValues).optional(),
  description: z.string().max(500).nullable().optional(),
  background_image: z.string().url().max(500).nullable().optional(),
});

/* ---- Message schema ---- */
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().max(MAX_MESSAGE_LENGTH, 'הודעה ארוכה מדי').optional(),
  type: z.enum(messageTypeValues).default('text'),
  mediaPath: z.string().optional(),
});

/* ---- Join event schema ---- */
export const joinEventSchema = z.object({
  eventSlug: z.string().min(1),
  joinCode: z.string().min(12).max(32),
});

/* ---- Push subscription schema ---- */
export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    }),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

/* ---- Photo reorder schema ---- */
export const photoReorderSchema = z.object({
  order: z
    .array(
      z.object({
        id: z.string().uuid(),
        order_index: z.number().int().min(0),
      })
    )
    .min(1)
    .max(10),
});

/* ---- Likes seen schema ---- */
export const likeSeenSchema = z.object({
  fromParticipantId: z.string().uuid().optional(),
  all: z.boolean().optional(),
}).refine(
  (d) => d.fromParticipantId || d.all,
  { message: 'fromParticipantId or all=true required' }
);

/* ---- Client-side image file validation ---- */
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** MIME types we accept for image uploads. */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

/**
 * Validate a File before uploading as an image.
 * Returns an error message string if invalid, or null if OK.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'ניתן להעלות תמונות בלבד';
  // Block SVG uploads (XSS vector)
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return 'קבצי SVG אינם נתמכים';
  }
  // Allowlist check
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'פורמט לא נתמך — נא להעלות JPEG, PNG, GIF, WebP או AVIF';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'הקובץ גדול מדי — עד 20MB';
  return null;
}

/**
 * Validate image file magic bytes (binary signature).
 * Call after reading the first bytes of the file.
 * Returns true if the bytes match the claimed MIME type.
 */
export function validateImageMagicBytes(
  bytes: Uint8Array,
  claimedType: string
): boolean {
  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/png': [[0x89, 0x50, 0x4e, 0x47]],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF container
    'image/avif': [], // ftyp box varies; skip magic check
  };

  const expected = signatures[claimedType];
  if (!expected || expected.length === 0) return true; // unknown or AVIF — allow

  return expected.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}
