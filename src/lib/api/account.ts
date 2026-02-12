/** Delete the current user's account and all associated data. */
export async function deleteAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}
