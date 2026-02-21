import { supabase } from '../supabase';
import type { PublicParticipant, ParticipantPhoto } from '../database.types';
import { PARTICIPANT_COLUMNS, PHOTO_COLUMNS } from './helpers';

/** Update the current user's profile fields. */
export async function updateProfile(
  participantId: string,
  data: Partial<PublicParticipant>
): Promise<PublicParticipant | null> {
  try {
    const res = await fetch('/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Fetch a single participant with their photos. */
export async function getParticipant(
  participantId: string
): Promise<(PublicParticipant & { photos: ParticipantPhoto[] }) | null> {
  const [participantRes, photosRes] = await Promise.all([
    supabase
      .from('participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('id', participantId)
      .single(),
    supabase
      .from('participant_photos')
      .select(PHOTO_COLUMNS)
      .eq('participant_id', participantId)
      .order('order_index'),
  ]);
  if (participantRes.error) console.error('[getParticipant] participant query error:', participantRes.error.message);
  if (photosRes.error) console.error('[getParticipant] photos query error:', photosRes.error.message);
  if (!participantRes.data) return null;

  return { ...participantRes.data, photos: photosRes.data || [] };
}
