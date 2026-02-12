import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const _supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!_supabaseUrl || !_supabaseAnonKey) {
  // Fail fast with a clear message instead of passing undefined to createClient
  throw new Error(
    'Missing required env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
  );
}

// Re-assign after guard so TypeScript knows these are `string`, not `string | undefined`
const supabaseUrl: string = _supabaseUrl;
const supabaseAnonKey: string = _supabaseAnonKey;

/* ── Event-scoped RLS context (CLIENT-SIDE ONLY) ──────────────── */
// This module-level var is safe because the anon client is only used
// in the browser (single user per tab). Server-side code uses
// getServiceClient() which does NOT read _currentEventId.
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

/** Service-role client — server-side only, full DB access (cached singleton) */
let _serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  _serviceClient = createClient(supabaseUrl, serviceKey);
  return _serviceClient;
}

/** Generate a random 16-char hex join code */
export function generateJoinCode(): string {
  return crypto.randomBytes(8).toString('hex');
}
