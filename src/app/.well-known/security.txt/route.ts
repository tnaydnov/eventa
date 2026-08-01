import { CONTACT_EMAIL, absoluteUrl } from '@/config/site';

/**
 * RFC 9116 security disclosure policy.
 *
 * Served only when a public contact address is configured - publishing a
 * `security.txt` without a working contact channel is worse than not having one.
 */
export async function GET() {
  if (!CONTACT_EMAIL) {
    return new Response('Not Found', { status: 404 });
  }

  // RFC 9116 requires an expiry; roll it forward a year from "now" at build/request time.
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const body = [
    '# Security disclosure policy (RFC 9116)',
    "# If you believe you've found a security vulnerability, please contact us.",
    '# We appreciate responsible disclosure and will respond promptly.',
    '',
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${expires}`,
    'Preferred-Languages: he, en',
    `Canonical: ${absoluteUrl('/.well-known/security.txt')}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
