import { z } from 'zod';
import {
  MAX_NAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_CITY_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_PHONE_LENGTH,
  MIN_PHONE_LENGTH,
} from './constants';

/* ---- Env validation ---- */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  CRON_SECRET: z.string().min(16).optional(),
  // SMS provider (optional - stubs used when absent)
  TEXTME_API_TOKEN: z.string().min(1).optional(),
  TEXTME_USERNAME: z.string().min(1).optional(),
  TEXTME_SENDER_NAME: z.string().min(1).max(11).optional(),
  // WhatsApp provider (optional - stubs used when absent)
  WA_API_KEY: z.string().min(1).optional(),
  WA_PHONE_NUMBER_ID: z.string().min(1).optional(),
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
    TEXTME_API_TOKEN: process.env.TEXTME_API_TOKEN,
    TEXTME_USERNAME: process.env.TEXTME_USERNAME,
    TEXTME_SENDER_NAME: process.env.TEXTME_SENDER_NAME,
    WA_API_KEY: process.env.WA_API_KEY,
    WA_PHONE_NUMBER_ID: process.env.WA_PHONE_NUMBER_ID,
  });
  if (!result.success) {
    // Use console.error here intentionally - logger.ts may depend on env vars
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
export const eventTypeValues = ['wedding', 'party', 'corporate', 'meetup', 'other'] as const;
export const eventStatusValues = ['draft', 'active', 'paused', 'ended', 'archived'] as const;
export const messageLogChannelValues = ['sms', 'whatsapp', 'email'] as const;
export const messagePurposeValues = [
  'otp', 'pre_event', 'welcome', 'feedback',
  'upload_reminder_7d', 'upload_reminder_3d',
  'upload_instructions', 'event_summary',
  'addon_invoice', 'custom_reminder',
] as const;
export const waCategoryValues = ['authentication', 'marketing', 'utility'] as const;

/* ---- Guest phone schemas ---- */
export const guestPhoneSchema = z.object({
  phone: z.string().min(MIN_PHONE_LENGTH).max(MAX_PHONE_LENGTH),
  name: z.string().max(100).optional(),
});

export const guestPhoneImportSchema = z.object({
  guests: z.array(guestPhoneSchema).min(1).max(500),
});

/** Manual admin email send types. */
export const adminEmailTypeValues = [
  'upload_reminder',
  'upload_urgent',
  'summary',
  'custom',
  'qr_page',
] as const;

export const adminSendEmailSchema = z.object({
  type: z.enum(adminEmailTypeValues),
  subject: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
});

/** Admin messaging toggle / manual trigger schema. */
export const adminMessagingPatchSchema = z.object({
  wa_messages_enabled: z.boolean().optional(),
  messaging_config: z
    .object({
      pre_event_hours_before: z.number().int().min(1).max(24).optional(),
      feedback_hours_after: z.number().int().min(1).max(24).optional(),
      upload_reminder_days: z.array(z.number().int().min(1).max(30)).max(5).optional(),
    })
    .optional(),
});

export const adminMessagingTriggerSchema = z.object({
  action: z.enum(['send_pre_event', 'send_feedback']),
});

/* ---- Phone number schema ---- */
export const phoneSchema = z
  .string()
  .min(MIN_PHONE_LENGTH, 'מספר טלפון קצר מדי')
  .max(MAX_PHONE_LENGTH, 'מספר טלפון ארוך מדי');

/** Israeli mobile phone validation (050-058 prefixes, 10 digits). */
export const israeliPhoneSchema = z
  .string()
  .regex(
    /^05[0-8]\d{7}$/,
    'מספר טלפון ישראלי לא תקין (05X-XXXXXXX)',
  );

/** Pretty slug validation (3-60 chars, alphanumeric + hyphens). */
export const prettySlugSchema = z
  .string()
  .min(3, 'slug חייב להכיל לפחות 3 תווים')
  .max(60, 'slug חייב להכיל עד 60 תווים')
  .regex(
    /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/,
    'slug חייב להכיל רק אותיות קטנות, מספרים ומקפים, ללא מקף בתחילה/סוף',
  );

/* ---- Send OTP schema ---- */
export const sendOtpSchema = z.object({
  phone: phoneSchema,
  eventSlug: z.string().min(1),
  joinCode: z.string().min(6).max(32),
});

/* ---- Verify OTP schema ---- */
export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().min(4).max(8),
  eventSlug: z.string().min(1),
  joinCode: z.string().min(6).max(32),
  fingerprint: z.string().max(64).optional(),
  hardwareFingerprint: z.string().max(128).optional(),
  smsConsent: z.boolean(),
});

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
  wa_messages_enabled: z.boolean().optional(),
  client_name: z.string().max(100).optional(),
  client_email: z.string().email().max(200).optional(),
  client_phone: z.string().max(20).optional(),
  communication_preference: z.enum(['email', 'phone', 'whatsapp', 'call-me']).optional(),
});

/* ---- Admin update event schema ---- */
// Exclude 'archived' - must go through the dedicated archive endpoint
const updateableStatusValues = eventStatusValues.filter((s) => s !== 'archived') as [string, ...string[]];
export const updateEventSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug חייב להכיל רק אותיות קטנות, מספרים ומקפים').optional(),
  event_type: z.enum(eventTypeValues).optional(),
  status: z.enum(updateableStatusValues).optional(),
  description: z.string().max(500).nullable().optional(),
  background_image: z.string().url().max(500).nullable().optional(),
  client_name: z.string().max(100).nullable().optional(),
  client_email: z.string().email().max(200).nullable().optional(),
  client_phone: z.string().max(20).nullable().optional(),
  communication_preference: z.enum(['email', 'phone', 'whatsapp', 'call-me']).nullable().optional(),
  payment_status: z.enum(['unpaid', 'paid', 'waived']).optional(),
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
  joinCode: z.string().min(6).max(32),
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
  'image/heic',
  'image/heif',
]);

/** Map file extensions to MIME types (fallback when browser reports empty type). */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif',
};

/**
 * Infer the effective MIME type of a file.
 * Some Android browsers/WebViews leave file.type empty for camera captures.
 * Falls back to extension-based detection.
 */
export function getEffectiveImageType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || '';
}

/**
 * Validate a File before uploading as an image.
 * Returns an error message string if invalid, or null if OK.
 */
export function validateImageFile(file: File): string | null {
  const effectiveType = getEffectiveImageType(file);
  if (!effectiveType.startsWith('image/')) return 'ניתן להעלות תמונות בלבד';
  // Block SVG uploads (XSS vector)
  if (effectiveType === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return 'קבצי SVG אינם נתמכים';
  }
  // Allowlist check
  if (!ALLOWED_IMAGE_TYPES.has(effectiveType)) {
    return 'פורמט לא נתמך - נא להעלות JPEG, PNG, GIF, WebP או AVIF';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'הקובץ גדול מדי - עד 20MB';
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
    'image/heic': [], // ftyp box varies (ftypheic, ftypmif1); skip magic check
    'image/heif': [], // ftyp box varies; skip magic check
  };

  const expected = signatures[claimedType];
  if (!expected || expected.length === 0) return true; // unknown or container formats - allow

  return expected.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}
