/** Close / decline / expire a compass session. */
export async function closeCompass(sessionId: string, reason?: 'expired' | 'declined'): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/compass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close', sessionId, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Check whether a compass session can be started with another user. */
export async function checkCompassEligible(otherId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/compass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-eligible', otherId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.eligible === true;
  } catch {
    return false;
  }
}

/** Push a location + heading update for an active compass session. */
export async function updateCompassLocation(
  sessionId: string,
  lat: number,
  lng: number,
  accuracy: number,
  heading: number | null
) {
  await fetch('/api/secure/compass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'location', sessionId, lat, lng, accuracy, heading }),
  });
}
