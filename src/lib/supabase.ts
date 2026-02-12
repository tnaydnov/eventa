import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* ── Event-scoped RLS context ──────────────────────────────────── */

let _currentEventId: string | null = null;

/**
 * Set the current event context for RLS event-scoping.
 * All subsequent PostgREST queries through the anon client will
 * include the x-event-id header, which RLS policies check.
 * Call this once when the session is established.
 */
export function setEventContext(eventId: string | null) {
  _currentEventId = eventId;
}

/** Anon client — safe for client-side / read-only operations */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      if (_currentEventId) {
        const headers = new Headers((options as RequestInit).headers);
        headers.set('x-event-id', _currentEventId);
        return fetch(url, { ...(options as RequestInit), headers });
      }
      return fetch(url, options as RequestInit);
    },
  },
});

/** Service-role client — server-side only, full DB access */
export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, serviceKey);
}

/** Generate a random 16-char hex join code */
export function generateJoinCode(): string {
  return crypto.randomBytes(8).toString('hex');
}
