/**
 * Pretty slug generation for events.
 * Per design doc §28.5 — human-readable, SEO-friendly event URLs.
 *
 * Format: {type}-{city}-{mmdd}-{rand}
 * Example: wedding-tlv-0315-x7k
 *
 * Slug validation regex: /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/
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

/** Regex for valid pretty slugs: 3-30 chars, alphanumeric + hyphens, no leading/trailing hyphens. */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/**
 * Validate a slug string.
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Extract a city code from an event name string.
 * Looks for known city names (Hebrew or English) in the text.
 */
export function extractCity(eventName: string): string | null {
  const normalized = eventName.toLowerCase().trim();
  // Check each city name (longest first to avoid partial matches)
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
 * 1. Build parts: {type}-{city}-{mmdd}
 * 2. Add random suffix for uniqueness
 * 3. If collision, retry with new random suffix (up to 5 attempts)
 * 4. Final fallback: full UUID-based slug
 *
 * @param eventName - Event name (may contain city hints)
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
  // Type code
  const typeCode = TYPE_CODES[eventType] || TYPE_CODES.other;

  // City code (optional)
  const cityCode = extractCity(eventName);

  // Date code: MMDD from starts_at
  let dateCode = '';
  try {
    const d = new Date(startsAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateCode = `${mm}${dd}`;
  } catch {
    dateCode = '';
  }

  // Build base slug
  const parts = [typeCode];
  if (cityCode) parts.push(cityCode);
  if (dateCode) parts.push(dateCode);
  const basePart = parts.join('-');

  // Try with random suffix up to 5 times
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${basePart}-${randomSlugSuffix()}`;
    if (isValidSlug(slug) && await checkSlugAvailable(slug, supabase)) {
      return slug;
    }
  }

  // Final fallback: UUID-based
  const fallback = `${typeCode}-${crypto.randomUUID().slice(0, 8)}`;
  return fallback;
}
