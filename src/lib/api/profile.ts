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
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[updateProfile] failed:', res.status, errText);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('[updateProfile] error:', err);
    return null;
  }
}

/** Fetch a single participant with their photos via the server-side endpoint (handles decryption). */
export async function getParticipant(
  participantId: string
): Promise<(PublicParticipant & { photos: ParticipantPhoto[] }) | null> {
  try {
    const res = await fetch(`/api/secure/participants?id=${encodeURIComponent(participantId)}`);
    if (!res.ok) {
      console.error('[getParticipant] fetch failed:', res.status);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('[getParticipant] error:', err);
    return null;
  }
}

/** Fetch the current user's own profile (includes phone, SMS settings). */
export async function getMyParticipant(): Promise<(PublicParticipant & { photos: ParticipantPhoto[] }) | null> {
  try {
    const res = await fetch('/api/secure/participants?me=1');
    if (!res.ok) {
      console.error('[getMyParticipant] fetch failed:', res.status);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('[getMyParticipant] error:', err);
    return null;
  }
}
