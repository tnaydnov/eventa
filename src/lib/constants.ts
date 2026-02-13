/**
 * Shared application-wide constants.
 * Keep values here instead of duplicating across client / server files.
 */

// ─── Compass ────────────────────────────────────────────

/** Compass request timeout: 5 minutes (ms). */
export const COMPASS_TIMEOUT_MS = 5 * 60 * 1000;

/** Geolocation watch: max cached position age (ms). */
export const GEO_MAX_AGE_MS = 1000;

/** Geolocation watch: timeout before error (ms). */
export const GEO_TIMEOUT_MS = 10_000;

/** Accuracy threshold (meters) above which a low-accuracy warning is shown. */
export const GEO_LOW_ACCURACY_THRESHOLD = 30;

/** Minimum distance (meters) before sending a GPS update to the server. */
export const GEO_THROTTLE_DISTANCE_M = 1;

/** Minimum interval (ms) between GPS updates sent to the server. */
export const GEO_THROTTLE_INTERVAL_MS = 1000;

/** Heading low-pass filter factor (0 = ignore new, 1 = no smoothing). */
export const HEADING_SMOOTH_FACTOR = 0.2;

/** Speed threshold (m/s) above which GPS heading is used instead of compass. */
export const GPS_HEADING_SPEED_THRESHOLD = 0.5;

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

// ─── Event Types ────────────────────────────────────────
// Hebrew labels for event types, keyed by DB value.

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'חתונה',
  party: 'מסיבה',
  brit: 'ברית',
  bar_mitzvah: 'בר/בת מצווה',
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
  brit: '👶',
  bar_mitzvah: '🎓',
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
