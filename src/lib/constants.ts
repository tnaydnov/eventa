/**
 * Shared application-wide constants.
 * Keep values here instead of duplicating across client / server files.
 */

// ─── Photos ─────────────────────────────────────────────

/** Maximum number of photos a participant may upload. */
export const MAX_PHOTOS = 10;

/** Maximum file size for admin background image upload (5 MB). */
export const MAX_BACKGROUND_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Field limits ───────────────────────────────────────
// Used in Zod schemas, server-side sanitizeWithLimit, and client maxLength attrs.

/** Maximum display name length. */
export const MAX_NAME_LENGTH = 30;

/** Maximum bio length. */
export const MAX_BIO_LENGTH = 200;

/** Maximum city name length. */
export const MAX_CITY_LENGTH = 50;

/** Maximum chat message length. */
export const MAX_MESSAGE_LENGTH = 2000;

// ─── Looking-For labels ─────────────────────────────────
// Hebrew labels for the "looking for" field, keyed by DB value.

export const LOOKING_FOR_LABELS: Record<string, string> = {
  serious: 'קשר רציני',
  casual: 'משהו קליל',
  friends: 'חברים/ות',
  figuring_out: 'עוד לא יודע/ת',
};

export const LOOKING_FOR_OPTIONS = Object.entries(LOOKING_FOR_LABELS).map(
  ([value, label]) => ({ value, label })
);

// ─── Cleanup ────────────────────────────────────────────

/** Days after event end before data is cleaned up. */
export const RETENTION_DAYS = 7;

/** Number of storage objects to delete per batch during cleanup. */
export const STORAGE_BATCH_SIZE = 100;

// ─── Phone ──────────────────────────────────────────────

/** Maximum phone number length (E.164). */
export const MAX_PHONE_LENGTH = 20;

/** Minimum phone number length. */
export const MIN_PHONE_LENGTH = 10;

/** Israeli mobile prefixes for validation. */
export const IL_MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '056', '058'] as const;

// ─── Messaging ──────────────────────────────────────────

/** Default discount code included in feedback messages. */
export const DEFAULT_DISCOUNT_CODE = 'EVENTA10';

/** Discount code validity period in months. */
export const DISCOUNT_VALIDITY_MONTHS = 6;

// ─── Event Types ────────────────────────────────────────
// Hebrew labels for event types, keyed by DB value.

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'חתונה',
  party: 'מסיבה',
  corporate: 'אירוע חברה',
  meetup: 'מיטאפ',
  other: 'אחר',
};

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const EVENT_TYPE_ICONS: Record<string, string> = {
  wedding: '💒',
  party: '🎉',
  corporate: '🏢',
  meetup: '🤝',
  other: '📌',
};

// ─── Event Statuses ─────────────────────────────────────

export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטא',
  active: 'פעיל',
  paused: 'מושהה',
  ended: 'הסתיים',
  archived: 'בארכיון',
};

export const EVENT_STATUS_OPTIONS = Object.entries(EVENT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);
