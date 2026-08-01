/**
 * Client-side signed photo URL cache.
 *
 * When the photos Supabase Storage bucket is made PRIVATE, this module provides
 * signed URLs (with configurable TTL) so photos can still be served through the CDN
 * without exposing them publicly.
 *
 * While the bucket is still public, signed URLs are used when available and the
 * old public URL is used as a fallback — so no visual change occurs before or
 * after the bucket privacy switch.
 *
 * Thread-safety note: this module is client-side only (browser). There is no
 * concurrent write contention. Map operations are synchronous.
 */

interface CacheEntry {
  /** Full signed URL returned by Supabase (includes the ?token=... query param). */
  signedUrl: string;
  /** Unix timestamp (ms) when this entry expires. */
  expiresAt: number;
}

/** Default TTL for signed URLs — Supabase signs for 1 h; we cache for 55 min. */
const CACHE_TTL_MS = 55 * 60 * 1000;

/** Refresh if remaining TTL is less than this value. */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

/** Store a signed URL in the cache. */
export function setSignedUrl(storagePath: string, signedUrl: string, ttlMs = CACHE_TTL_MS): void {
  cache.set(storagePath, { signedUrl, expiresAt: Date.now() + ttlMs });
}

/**
 * Retrieve a valid (non-expired) signed URL from the cache.
 * Returns null if the entry is missing or expired.
 */
export function getSignedUrl(storagePath: string): string | null {
  const entry = cache.get(storagePath);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(storagePath);
    return null;
  }
  return entry.signedUrl;
}

/** Check if a path is about to expire and needs a refresh. */
export function needsRefresh(storagePath: string): boolean {
  const entry = cache.get(storagePath);
  if (!entry) return true;
  return entry.expiresAt - Date.now() < REFRESH_THRESHOLD_MS;
}

/** Clear the entire cache (e.g. on logout / event change). */
export function clearSignedUrlCache(): void {
  cache.clear();
}

/** Batch-fetch signed URLs from the server and populate the cache. */
export async function prefetchSignedUrls(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Only fetch paths that are missing or about to expire
  const needed = paths.filter((p) => p && needsRefresh(p));
  if (needed.length === 0) return;

  try {
    const res = await fetch('/api/secure/photo-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: needed }),
      credentials: 'include', // send session cookie
    });
    if (!res.ok) return; // silently fail — fall back to public URLs
    const data = await res.json() as Record<string, string>;
    for (const [path, signedUrl] of Object.entries(data)) {
      if (typeof signedUrl === 'string') {
        setSignedUrl(path, signedUrl);
      }
    }
  } catch {
    // Network error or auth failure — the public URL fallback will be used
  }
}
