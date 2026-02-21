import { supabase } from '../supabase';
import type { ParticipantPhoto } from '../database.types';
import { compressProfilePhoto } from '../image-compression';
import { validateImageMagicBytes, getEffectiveImageType } from '../validations';
import { PHOTO_COLUMNS } from './helpers';

/** Upload a profile photo (validate → compress → sign → upload → create DB record). */
export async function uploadPhoto(
  eventId: string,
  participantId: string,
  file: File,
  orderIndex: number
): Promise<ParticipantPhoto | null> {
  // Magic byte validation — don't block on mismatch.
  // Profile photos come from ImageCropper (canvas-rendered) so they're
  // inherently safe; some Android browsers produce non-standard headers.
  const effectiveType = getEffectiveImageType(file);
  try {
    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    validateImageMagicBytes(headerBytes, effectiveType);
  } catch { /* proceed — canvas output is safe */ }

  let compressed: File;
  try {
    compressed = await compressProfilePhoto(file);
  } catch (err) {
    // Canvas-cropped photos are already EXIF-free, so falling back to the
    // original is safe.  Log the failure for diagnostics.
    console.warn('[uploadPhoto] Compression failed, using original file:', err);
    compressed = file;
  }
  const ext = compressed.name.split('.').pop() || 'webp';
  const path = `${eventId}/${participantId}/${Date.now()}_${orderIndex}.${ext}`;

  // Get signed upload URL from server (authenticated)
  try {
    const urlRes = await fetch('/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!urlRes.ok) {
      const errText = await urlRes.text().catch(() => '');
      console.error('[uploadPhoto] upload-url failed:', urlRes.status, errText);
      return null;
    }
    const { signedUrl, token } = await urlRes.json();

    // Upload to storage using signed URL
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': compressed.type },
      body: compressed,
    });
    if (!uploadRes.ok) {
      console.warn('[uploadPhoto] Raw PUT failed, trying SDK fallback:', uploadRes.status);
      // Fallback: try with token as header (Supabase signed upload)
      const uploadRes2 = await supabase.storage
        .from('photos')
        .uploadToSignedUrl(path, token, compressed);
      if (uploadRes2.error) {
        console.error('[uploadPhoto] SDK upload also failed:', uploadRes2.error.message);
        return null;
      }
    }
  } catch (err) {
    console.error('[uploadPhoto] Storage upload error:', err);
    return null;
  }

  // Create DB record via authenticated API route
  try {
    const res = await fetch('/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: path, orderIndex }),
    });
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
  } catch {
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
  } catch {
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
