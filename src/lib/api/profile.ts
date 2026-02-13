import { supabase } from '../supabase';
import type { Participant, ParticipantPhoto } from '../database.types';
import { PARTICIPANT_COLUMNS, PHOTO_COLUMNS } from './helpers';

/** Update the current user's profile fields. */
export async function updateProfile(
  participantId: string,
  data: Partial<Participant>
): Promise<Participant | null> {
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
): Promise<(Participant & { photos: ParticipantPhoto[] }) | null> {
  const [{ data: p }, { data: photos }] = await Promise.all([
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
  if (!p) return null;

  return { ...p, photos: photos || [] };
}
