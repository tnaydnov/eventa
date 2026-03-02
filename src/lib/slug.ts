/**
 * Pretty slug generation for events.
 *
 * Primary strategy: derive a human-readable slug from the event name
 *   "Tomer & Eden"        → tomer-and-eden
 *   "Wedding Lior & Noa"  → lior-and-noa
 *   "Party in TLV"        → party-in-tlv
 *
 * On collision (another active event has the same slug):
 *   tomer-and-eden-2, tomer-and-eden-3, …
 *
 * Fallback (if the name produces no usable slug):
 *   {type}-{mmdd}-{rand}  (e.g. wedding-0303-x7k)
 *
 * Slug validation regex: /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/
 */
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── City codes (top 17 Israeli cities) ─────────────────────

export const CITY_CODES: Record<string, string> = {
  'תל אביב': 'tlv',
  'tel aviv': 'tlv',
  'ירושלים': 'jlm',
  'jerusalem': 'jlm',
  'חיפה': 'hfa',
  'haifa': 'hfa',
  'באר שבע': 'bsv',
  'beer sheva': 'bsv',
  'נתניה': 'ntn',
  'netanya': 'ntn',
  'הרצליה': 'hzl',
  'herzliya': 'hzl',
  'רמת גן': 'rmg',
  'ramat gan': 'rmg',
  'ראשון לציון': 'rsh',
  'rishon': 'rsh',
  'פתח תקווה': 'ptk',
  'petah tikva': 'ptk',
  'אשדוד': 'asd',
  'ashdod': 'asd',
  'אשקלון': 'ask',
  'ashkelon': 'ask',
  'רחובות': 'rhv',
  'rehovot': 'rhv',
  'כפר סבא': 'kfs',
  'kfar saba': 'kfs',
  'רעננה': 'rnn',
  'raanana': 'rnn',
  'גבעתיים': 'gvt',
  'givatayim': 'gvt',
  'בת ים': 'bty',
  'bat yam': 'bty',
  'הוד השרון': 'hds',
  'hod hasharon': 'hds',
};

// ─── Event type codes ────────────────────────────────────────

export const TYPE_CODES: Record<string, string> = {
  wedding: 'wedding',
  party: 'party',
  corporate: 'corp',
  meetup: 'meetup',
  speed_dating: 'speed',
  singles_event: 'singles',
  other: 'event',
};

// ─── Slug validation ────────────────────────────────────────

/** Regex for valid pretty slugs: 3-60 chars, alphanumeric + hyphens, no leading/trailing hyphens. */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

/**
 * Validate a slug string.
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Hebrew-to-English transliteration map (common names / words).
 * Not exhaustive — just enough for event names.
 */
const HE_TRANSLIT: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
  'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
};

/**
 * Transliterate a string (Hebrew → Latin, strip accents, lowercase).
 * Non-transliterable chars pass through (English stays as-is).
 */
function transliterate(str: string): string {
  let result = '';
  for (const ch of str) {
    if (HE_TRANSLIT[ch]) {
      result += HE_TRANSLIT[ch];
    } else {
      result += ch;
    }
  }
  return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Convert a free-form event name into a URL-safe slug base.
 * Replaces & with "and", strips non-alphanumeric, collapses hyphens.
 */
function nameToSlug(name: string): string {
  let s = transliterate(name);
  // Replace common connecting symbols with "and"
  s = s.replace(/\s*[&+]\s*/g, '-and-');
  // Replace spaces and underscores with hyphens
  s = s.replace(/[\s_]+/g, '-');
  // Remove anything that isn't alphanumeric or hyphen
  s = s.replace(/[^a-z0-9-]/g, '');
  // Collapse multiple hyphens
  s = s.replace(/-{2,}/g, '-');
  // Trim leading/trailing hyphens
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

/**
 * Strip common event-type prefixes from a name so we get just the people/place.
 * "Wedding Tomer & Eden" → "Tomer & Eden"
 * "חתונה של תומר ועדן"  → "תומר ועדן"
 */
const TYPE_PREFIXES = [
  // English
  /^wedding\s+(of\s+)?/i,
  /^party\s+(of\s+|for\s+)?/i,
  /^event\s+(of\s+|for\s+)?/i,
  /^birthday\s+(of\s+|for\s+|party\s+)?/i,
  /^corporate\s+(event\s+)?/i,
  /^meetup\s+(for\s+)?/i,
  // Hebrew
  /^(ה)?(חתונה|אירוע|מסיבה|יום הולדת|מפגש)\s+(של\s+)?/,
];

function stripTypePrefix(name: string): string {
  let result = name.trim();
  for (const re of TYPE_PREFIXES) {
    result = result.replace(re, '');
  }
  return result.trim() || name.trim();
}

/**
 * Extract a city code from an event name string.
 * Looks for known city names (Hebrew or English) in the text.
 */
export function extractCity(eventName: string): string | null {
  const normalized = eventName.toLowerCase().trim();
  const cityNames = Object.keys(CITY_CODES).sort((a, b) => b.length - a.length);
  for (const name of cityNames) {
    if (normalized.includes(name.toLowerCase())) {
      return CITY_CODES[name];
    }
  }
  return null;
}

/**
 * Generate a short random suffix (3 chars, alphanumeric).
 */
function randomSlugSuffix(): string {
  return crypto.randomBytes(2).toString('base64url').slice(0, 3).toLowerCase();
}

/**
 * Check if a slug is available (not used by any non-archived event).
 */
export async function checkSlugAvailable(
  slug: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .neq('status', 'archived')
    .maybeSingle();
  return !data;
}

/**
 * Generate a pretty, human-readable slug for an event.
 *
 * Algorithm:
 * 1. Strip type prefix from name ("Wedding Tomer & Eden" → "Tomer & Eden")
 * 2. Transliterate Hebrew → Latin if needed
 * 3. Convert to URL-safe slug ("tomer-and-eden")
 * 4. If collision, try "tomer-and-eden-2", "tomer-and-eden-3", … (up to 20)
 * 5. Fallback: {type}-{mmdd}-{rand}
 *
 * @param eventName - Event name (e.g. "Tomer & Eden")
 * @param eventType - Event type key (e.g. 'wedding', 'party')
 * @param startsAt  - ISO date string of event start
 * @param supabase  - Supabase client for uniqueness check
 */
export async function generatePrettySlug(
  eventName: string,
  eventType: string,
  startsAt: string,
  supabase: SupabaseClient,
): Promise<string> {
  // ── 1. Try name-based slug ──
  const stripped = stripTypePrefix(eventName);
  const baseSlug = nameToSlug(stripped);

  // Only use the name-based slug if it's at least 3 chars
  if (baseSlug.length >= 3) {
    // Trim to a reasonable length (max 50 chars for the base)
    const trimmed = baseSlug.slice(0, 50).replace(/-$/, '');

    // First attempt: exact name slug
    if (isValidSlug(trimmed) && await checkSlugAvailable(trimmed, supabase)) {
      return trimmed;
    }

    // Collision: try -2, -3, … up to -20
    for (let i = 2; i <= 20; i++) {
      const candidate = `${trimmed}-${i}`;
      if (isValidSlug(candidate) && await checkSlugAvailable(candidate, supabase)) {
        return candidate;
      }
    }
  }

  // ── 2. Fallback: type-date-random ──
  const typeCode = TYPE_CODES[eventType] || TYPE_CODES.other;

  let dateCode = '';
  try {
    const d = new Date(startsAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateCode = `${mm}${dd}`;
  } catch {
    dateCode = '';
  }

  const parts = [typeCode];
  if (dateCode) parts.push(dateCode);
  const basePart = parts.join('-');

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${basePart}-${randomSlugSuffix()}`;
    if (isValidSlug(slug) && await checkSlugAvailable(slug, supabase)) {
      return slug;
    }
  }

  // Ultimate fallback
  return `${typeCode}-${crypto.randomUUID().slice(0, 8)}`;
}
