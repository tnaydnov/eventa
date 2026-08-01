/** Delete the current user's account and all associated data. */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}', // non-empty body ensures Origin header is sent on all Android browsers
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => '');
    console.error('[deleteAccount] failed:', res.status, text);
    return { ok: false, error: `${res.status}` };
  } catch (err) {
    console.error('[deleteAccount] network error:', err);
    return { ok: false, error: 'network' };
  }
}
