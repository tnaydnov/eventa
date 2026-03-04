import { invalidateBlockedCache } from './helpers';

/** Block another participant. */
export async function blockParticipant(blockedId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId }),
    });
    if (res.ok) invalidateBlockedCache();
    return res.ok;
  } catch (err) {
    console.error('[blockParticipant] error:', err);
    return false;
  }
}
