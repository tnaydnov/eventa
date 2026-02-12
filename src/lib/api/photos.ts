import { supabase } from '../supabase';
import type { ParticipantPhoto } from '../database.types';
import { compressProfilePhoto } from '../image-compression';
import { PHOTO_COLUMNS } from './helpers';

/** Upload a profile photo (compress → sign → upload → create DB record). */
export async function uploadPhoto(
  eventId: string,
  participantId: string,
  file: File,
  orderIndex: number
): Promise<ParticipantPhoto | null> {
  const compressed = await compressProfilePhoto(file);
  const ext = compressed.name.split('.').pop() || 'webp';
  const path = `${eventId}/${participantId}/${Date.now()}_${orderIndex}.${ext}`;

  // Get signed upload URL from server (authenticated)
  try {
    const urlRes = await fetch('/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!urlRes.ok) return null;
    const { signedUrl, token } = await urlRes.json();

    // Upload to storage using signed URL
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': compressed.type },
      body: compressed,
    });
    if (!uploadRes.ok) {
      // Fallback: try with token as header (Supabase signed upload)
      const uploadRes2 = await supabase.storage
        .from('photos')
        .uploadToSignedUrl(path, token, compressed);
      if (uploadRes2.error) return null;
    }
  } catch {
    return null;
  }

  // Create DB record via authenticated API route
  try {
    const res = await fetch('/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: path, orderIndex }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
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
  const { data } = await supabase
    .from('participant_photos')
    .select(PHOTO_COLUMNS)
    .eq('participant_id', participantId)
    .order('order_index');
  return data || [];
}
