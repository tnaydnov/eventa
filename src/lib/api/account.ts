/** Delete the current user's account and all associated data. */
export async function deleteAccount(
  participantId: string,
  eventId: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, eventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
