/** Block another participant. */
export async function blockParticipant(blockedId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
