import type { PublicParticipant } from '../database.types';

// ─── OTP Auth ───────────────────────────────────────────────

/** Request an OTP code to be sent via SMS to the given phone. */
export async function sendOtp(params: {
  phone: string;
  eventSlug: string;
  joinCode: string;
}): Promise<{
  success: boolean;
  expiresIn?: number;
  maskedPhone?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  } catch {
    return { success: false, error: 'שגיאה בשליחת הקוד — נסו שוב' };
  }
}

/** Verify OTP and complete join (creates or reconnects participant). */
export async function verifyOtp(params: {
  phone: string;
  code: string;
  eventSlug: string;
  joinCode: string;
  fingerprint?: string;
  hardwareFingerprint?: string;
  smsConsent: boolean;
  feedbackConsent: boolean;
}): Promise<{
  eventId: string;
  eventName: string;
  backgroundImage: string | null;
  participantId: string;
  participant: PublicParticipant | null;
}> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('DEVICE_BANNED');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'אימות הקוד נכשל — נסו שוב');
  }
  return res.json();
}

// ─── Fingerprint-based Join ─────────────────────────────────

/** Join an event using slug + code; returns session details or null. */
export async function joinEvent(
  eventSlug: string,
  joinCode: string,
  clientLocalId?: string,
  hardwareFingerprint?: string
): Promise<{
  eventId: string;
  eventName: string;
  backgroundImage: string | null;
  participantId: string;
  participant: PublicParticipant | null;
} | null> {
  try {
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventSlug,
        joinCode,
        fingerprint: clientLocalId,
        hardwareFingerprint,
      }),
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
