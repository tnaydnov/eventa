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
});

/** Validate environment variables at import time (server + client) */
export function validateEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
  }
  return result;
}

/* ---- Enum values ---- */
export const genderValues = ['male', 'female', 'other'] as const;
export const attractedToValues = ['men', 'women', 'all'] as const;
export const lookingForValues = ['serious', 'casual', 'friends', 'figuring_out'] as const;
export const messageTypeValues = ['text', 'image', 'audio'] as const;
export const eventTypeValues = ['wedding', 'party', 'brit', 'bar_mitzvah', 'corporate', 'meetup', 'other'] as const;
export const eventStatusValues = ['draft', 'active', 'paused', 'ended', 'archived'] as const;

/* ---- Profile setup schema ---- */
export const profileSetupSchema = z.object({
  display_name: z
    .string()
    .min(1, 'נא להזין שם')
    .max(MAX_NAME_LENGTH, `שם ארוך מדי (עד ${MAX_NAME_LENGTH} תווים)`)
    .transform((v) => v.trim()),
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
export const updateEventSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug חייב להכיל רק אותיות קטנות, מספרים ומקפים').optional(),
  event_type: z.enum(eventTypeValues).optional(),
  status: z.enum(eventStatusValues).optional(),
  description: z.string().max(500).nullable().optional(),
  background_image: z.string().url().max(500).nullable().optional(),
});

/* ---- Message schema ---- */
export const sendMessageSchema = z.object({
  text: z.string().max(MAX_MESSAGE_LENGTH, 'הודעה ארוכה מדי').optional(),
  type: z.enum(messageTypeValues).default('text'),
  mediaPath: z.string().optional(),
});

/* ---- Join event schema ---- */
export const joinEventSchema = z.object({
  eventSlug: z.string().min(1),
  joinCode: z.string().min(12).max(32),
});

/* ---- Client-side image file validation ---- */
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validate a File before uploading as an image.
 * Returns an error message string if invalid, or null if OK.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'ניתן להעלות תמונות בלבד';
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'הקובץ גדול מדי — עד 20MB';
  return null;
}
