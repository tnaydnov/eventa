import { supabase } from '../supabase';
import type { ParticipantPhoto } from '../database.types';
import { compressProfilePhoto } from '../image-compression';
import { validateImageMagicBytes, getEffectiveImageType } from '../validations';
import { fetchWithRetry } from './fetch-retry';
import { PHOTO_COLUMNS } from './helpers';

/**
 * Upload a file to a Supabase signed URL using XHR so we get progress events.
 * Retries on network/5xx failures up to 3 times with exponential backoff.
 */
async function xhrUpload(
  signedUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const BACKOFFS_MS = [0, 1_000, 3_000];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (BACKOFFS_MS[attempt] > 0) {
      await new Promise((r) =>
        setTimeout(r, BACKOFFS_MS[attempt] * (0.8 + Math.random() * 0.4)),
      );
    }

    let httpStatus: number;
    try {
      httpStatus = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 60_000;
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          });
        }
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => reject(new Error('network error'));
        xhr.ontimeout = () => reject(new Error('timeout'));
        xhr.send(file);
      });
    } catch (err) {
      if (attempt < MAX_ATTEMPTS - 1) continue;
      throw err;
    }

    if (httpStatus >= 200 && httpStatus < 300) return; // success
    if (httpStatus >= 400 && httpStatus < 500) throw new Error(`HTTP ${httpStatus}`); // client error — don't retry
    if (attempt < MAX_ATTEMPTS - 1) continue; // 5xx — retry
    throw new Error(`HTTP ${httpStatus}`);
  }
}

/** Upload a profile photo (validate → compress → sign → upload → create DB record). */
export async function uploadPhoto(
  eventId: string,
  participantId: string,
  file: File,
  orderIndex: number,
  /** Optional progress callback — receives 0–100 as bytes are uploaded. */
  onProgress?: (pct: number) => void,
): Promise<ParticipantPhoto | null> {
  // Magic byte validation - don't block on mismatch.
  // Profile photos come from ImageCropper (canvas-rendered) so they're
  // inherently safe; some Android browsers produce non-standard headers.
  const effectiveType = getEffectiveImageType(file);
  try {
    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    validateImageMagicBytes(headerBytes, effectiveType);
  } catch { /* proceed - canvas output is safe */ }

  let compressed: File;
  try {
    compressed = await compressProfilePhoto(file);
  } catch (err) {
    // Canvas-cropped photos are already EXIF-free, so falling back to the
    // original is safe.  Log the failure for diagnostics.
    console.error('[uploadPhoto] Compression failed, using original file:', err);
    compressed = file;
  }
  const ext = compressed.name.split('.').pop() || 'webp';
  const path = `${eventId}/${participantId}/${Date.now()}_${orderIndex}.${ext}`;
  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Get signed upload URL from server (authenticated)
  try {
    const urlRes = await fetchWithRetry(
      '/api/secure/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      },
      // Safe to retry: this endpoint only returns a signed URL for the same path.
      { retryOnMutations: true },
    );
    if (!urlRes.ok) {
      const errText = await urlRes.text().catch(() => '');
      console.error('[uploadPhoto] upload-url failed:', urlRes.status, errText);
      return null;
    }
    const { signedUrl, token } = await urlRes.json();

    if (onProgress) {
      // Upload to storage via XHR (progress events + auto-retry on 5xx/network)
      try {
        await xhrUpload(signedUrl, compressed, onProgress);
      } catch (xhrErr) {
        console.error('[uploadPhoto] XHR upload failed, trying SDK fallback:', xhrErr);
        // Fallback: use the Supabase SDK signed URL upload path
        const uploadRes2 = await supabase.storage
          .from('photos')
          .uploadToSignedUrl(path, token, compressed);
        if (uploadRes2.error) {
          console.error('[uploadPhoto] SDK upload also failed:', uploadRes2.error.message);
          return null;
        }
      }
    } else {
      // Non-UI callers don't need progress events; use SDK upload directly.
      const uploadRes = await supabase.storage
        .from('photos')
        .uploadToSignedUrl(path, token, compressed);
      if (uploadRes.error) {
        console.error('[uploadPhoto] SDK upload failed:', uploadRes.error.message);
        return null;
      }
    }
  } catch (err) {
    console.error('[uploadPhoto] Storage upload error:', err);
    return null;
  }

  // Create DB record via authenticated API route
  try {
    const res = await fetchWithRetry(
      '/api/secure/photos',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ storagePath: path, orderIndex }),
      },
      // Safe to retry: server deduplicates by storagePath and returns existing row.
      { retryOnMutations: true },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[uploadPhoto] DB record creation failed:', res.status, errText);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('[uploadPhoto] DB record error:', err);
    return null;
  }
}

/** Delete a profile photo by ID. */
export async function deletePhoto(photoId: string, storagePath: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, storagePath }),
    });
    return res.ok;
  } catch (err) {
    console.error('[deletePhoto] error:', err);
    return false;
  }
}

/** Reorder profile photos. */
export async function reorderPhotos(
  order: { id: string; order_index: number }[]
): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    return res.ok;
  } catch (err) {
    console.error('[reorderPhotos] error:', err);
    return false;
  }
}

/** Get the current user's photos. */
export async function getMyPhotos(
  participantId: string
): Promise<ParticipantPhoto[]> {
  const { data, error } = await supabase
    .from('participant_photos')
    .select(PHOTO_COLUMNS)
    .eq('participant_id', participantId)
    .order('order_index');
  if (error) console.error('[getMyPhotos] query error:', error.message);
  return data || [];
}

/** Get photos for any participant (used by realtime handlers on grid page). */
export async function getParticipantPhotos(
  participantId: string
): Promise<ParticipantPhoto[]> {
  const { data, error } = await supabase
    .from('participant_photos')
    .select(PHOTO_COLUMNS)
    .eq('participant_id', participantId)
    .order('order_index');
  if (error) console.error('[getParticipantPhotos] query error:', error.message);
  return data || [];
}
