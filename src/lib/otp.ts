/**
 * OTP generation, storage, and verification.
 * Codes are stored in the otp_verifications table with a configurable TTL.
 * Max attempts per code are configurable via env/config.
 */
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/messaging/phone-utils';
import {
  OTP_LENGTH,
  OTP_EXPIRY_S,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_S,
} from '@/lib/config';

/**
 * Generate a cryptographically secure N-digit OTP.
 * Uses crypto.randomBytes for CSPRNG quality.
 */
export function generateOtpCode(length: number = OTP_LENGTH): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const code = min + (randomNum % range);
  return code.toString();
}

/**
 * Hash an OTP code for storage / comparison (SECURITY_HARDENING_PLAN §5.3/§8.3).
 *
 * Codes are stored as a SHA-256 hash (hex, 64 chars) rather than plaintext, so a DB/
 * service-role leak does not expose live verification codes. A server-side `OTP_PEPPER`
 * (set once, never rotated mid-flight) is mixed in so the hash can't be brute-forced from
 * the DB alone - a 6-digit space is otherwise trivially reversible.
 */
function hashOtpCode(code: string): string {
  const pepper = process.env.OTP_PEPPER || '';
  return crypto.createHash('sha256').update(`${code}${pepper}`).digest('hex');
}

/**
 * Create and store a new OTP for a phone + event.
 * Invalidates any existing unused OTPs for the same phone + event.
 *
 * Returns the code on success, or an error string.
 */
export async function createOtp(
  phone: string,
  eventId: string
): Promise<{ code: string; expiresIn: number } | { error: string }> {
  const supabase = getServiceClient();

  // Check resend cooldown: prevent spamming
  const cooldownCutoff = new Date(
    Date.now() - OTP_RESEND_COOLDOWN_S * 1000
  ).toISOString();

  const { data: recent } = await supabase
    .from('otp_verifications')
    .select('id')
    .eq('phone', phone)
    .eq('event_id', eventId)
    .gte('created_at', cooldownCutoff)
    .eq('is_used', false)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return {
      error: `Please wait ${OTP_RESEND_COOLDOWN_S} seconds before requesting a new code`,
    };
  }

  // Invalidate all previous unused OTPs for this phone + event
  await supabase
    .from('otp_verifications')
    .update({ is_used: true })
    .eq('phone', phone)
    .eq('event_id', eventId)
    .eq('is_used', false);

  // Generate and store new OTP. The plaintext code is returned to the caller (to send
  // via SMS) but only its SHA-256+pepper hash is persisted (never the raw code).
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_S * 1000).toISOString();

  const { error } = await supabase.from('otp_verifications').insert({
    phone,
    event_id: eventId,
    code: hashOtpCode(code),
    attempts: 0,
    is_used: false,
    expires_at: expiresAt,
  });

  if (error) {
    logger.error('[OTP] Failed to create OTP', {
      phone: maskPhone(phone),
      eventId,
      error: error.message,
    });
    return { error: 'Failed to create verification code' };
  }

  return { code, expiresIn: OTP_EXPIRY_S };
}

/**
 * Verify an OTP code.
 * Returns valid: true if correct, or valid: false with an error reason.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyOtp(
  phone: string,
  eventId: string,
  code: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = getServiceClient();

  // Find the latest unused, non-expired OTP for this phone + event
  const now = new Date().toISOString();
  const { data: otp, error: fetchError } = await supabase
    .from('otp_verifications')
    .select('id, code, attempts, expires_at')
    .eq('phone', phone)
    .eq('event_id', eventId)
    .eq('is_used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    logger.error('[OTP] Verification lookup failed', {
      phone: maskPhone(phone),
      eventId,
      error: fetchError.message,
    });
    return { valid: false, error: 'Verification failed' };
  }

  if (!otp) {
    return {
      valid: false,
      error: 'Code expired or not found. Request a new code.',
    };
  }

  // Check max attempts
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    // Mark as used (exhausted)
    await supabase
      .from('otp_verifications')
      .update({ is_used: true })
      .eq('id', otp.id);
    return { valid: false, error: 'Too many attempts. Request a new code.' };
  }

  // Increment attempts
  await supabase
    .from('otp_verifications')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);

  // Timing-safe comparison to prevent timing attacks.
  // Stored value is a SHA-256 hex hash (64 chars) for codes created after the hashing
  // rollout; any older row (≤5 min TTL) may still hold a plaintext code. Detect by length
  // so the transition needs no migration and never rejects a valid in-flight code.
  const storedIsHash = otp.code.length === 64;
  const candidate = storedIsHash ? hashOtpCode(code) : code;
  const padLength = Math.max(candidate.length, otp.code.length, 10);
  const codeBuffer = Buffer.from(candidate.padEnd(padLength, '\0'));
  const otpBuffer = Buffer.from(otp.code.padEnd(padLength, '\0'));

  if (
    codeBuffer.length !== otpBuffer.length ||
    !crypto.timingSafeEqual(codeBuffer, otpBuffer)
  ) {
    return { valid: false, error: 'Incorrect code' };
  }

  // Mark OTP as used
  await supabase
    .from('otp_verifications')
    .update({ is_used: true })
    .eq('id', otp.id);

  return { valid: true };
}

/**
 * Cleanup expired OTPs (called from existing cleanup cron).
 * Deletes OTPs that expired more than 1 hour ago to be safe.
 */
export async function cleanupExpiredOtps(): Promise<number> {
  const supabase = getServiceClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('otp_verifications')
    .delete({ count: 'exact' })
    .lt('expires_at', oneHourAgo);

  if (error) {
    logger.error('[OTP] Cleanup failed', { error: error.message });
    return 0;
  }
  return count || 0;
}
