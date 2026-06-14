import { NextRequest, NextResponse } from 'next/server';
import { adminGuard, jsonError } from '../_helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { isTotpConfigured, getTotpSecret, buildTotpUri } from '@/lib/totp';

/**
 * GET /api/admin/totp-setup
 * Returns the otpauth:// URI so the admin can scan the QR code with an authenticator app.
 *
 * Security: protected by admin cookie. Only useful during initial TOTP setup.
 * The secret is read from ADMIN_TOTP_SECRET env — this endpoint never generates a new one.
 *
 * Setup flow:
 *   1. Generate a secret:  node -e "const c=require('crypto'); const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let b=c.randomBytes(20),s=''; for(const x of b){s+=a[x%32];} console.log(s);"
 *   2. Set ADMIN_TOTP_SECRET=<secret> in Vercel env vars
 *   3. Call GET /api/admin/totp-setup to get the QR URI
 *   4. Encode the URI as a QR code (e.g. https://api.qrserver.com/v1/create-qr-code/?data=<URI>)
 *   5. Scan with Google Authenticator / Authy
 */
export async function GET(req: NextRequest) {
  const denied = await adminGuard(req, 'admin-totp-setup', RATE_LIMITS.strict);
  if (denied) return denied;

  if (!isTotpConfigured()) {
    return NextResponse.json({
      configured: false,
      message: 'ADMIN_TOTP_SECRET is not set. Generate a secret and add it to your env vars.',
      hint: 'node -e "const c=require(\'crypto\'); const a=\'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567\'; let b=c.randomBytes(20),s=\'\'; for(const x of b){s+=a[x%32];} console.log(s);"',
    });
  }

  const secret = getTotpSecret()!;
  const uri = buildTotpUri(secret, 'Eventa Admin', 'Eventa');

  return NextResponse.json({
    configured: true,
    uri,
    // QR code URL via a public service — only used during setup, never in production flows
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`,
    secret, // show once for manual entry fallback
  });
}
