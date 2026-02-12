import type { Participant } from '../database.types';

/** Join an event using slug + code; returns session details or null. */
export async function joinEvent(
  eventSlug: string,
  joinCode: string,
  clientLocalId?: string
): Promise<{
  eventId: string;
  eventName: string;
  backgroundImage: string | null;
  participantId: string;
  participant: Participant | null;
} | null> {
  try {
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSlug, joinCode, fingerprint: clientLocalId }),
    });
    if (!res.ok) {
      // Surface specific error for banned devices
      if (res.status === 403) throw new Error('DEVICE_BANNED');
      return null;
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.message === 'DEVICE_BANNED') throw err;
    return null;
  }
}
