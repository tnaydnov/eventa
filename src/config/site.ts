/**
 * ============================================================================
 *  SITE CONFIGURATION - THE ONLY FILE YOU MUST EDIT TO REBRAND THIS APP
 * ============================================================================
 *
 * Every deployment-specific value (brand name, domain, contact details, legal
 * operator identity, social links, analytics IDs) is resolved here, from
 * `NEXT_PUBLIC_*` environment variables, with neutral placeholder defaults.
 *
 * Nothing else in `src/` should hardcode a domain, an email address, a phone
 * number, a social profile, or a company name. If you need one, add it here.
 *
 * All values are public by definition - they are inlined into the client
 * bundle at build time. NEVER put a secret in this file. Server-only secrets
 * live in `src/lib/config.ts` and are read from non-public env vars.
 *
 * See README.md -> "Configuration" for the full variable reference.
 */

/** Reads a public env var, returning `fallback` when unset or blank. */
function env(value: string | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

// ─── Brand ──────────────────────────────────────────────────

/** Product / brand name shown throughout the UI, emails and SMS. */
export const BRAND_NAME = env(process.env.NEXT_PUBLIC_BRAND_NAME, 'Eventa');

/** One-line product tagline used in page titles and Open Graph cards. */
export const BRAND_TAGLINE = env(
  process.env.NEXT_PUBLIC_BRAND_TAGLINE,
  'Turn Any Event Into an Experience',
);

/** Longer description used in meta tags and structured data. */
export const BRAND_DESCRIPTION = env(
  process.env.NEXT_PUBLIC_BRAND_DESCRIPTION,
  'Smart social layers for live events - matchmaking, networking and audience engagement.',
);

// ─── URLs ───────────────────────────────────────────────────

/**
 * Canonical public origin, no trailing slash.
 * Used for canonical tags, sitemap, Open Graph, QR/join links and e-mail links.
 */
export const SITE_URL = env(
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
).replace(/\/+$/, '');

/** Hostname only (e.g. `example.com`) - used as the JWT `iss` claim. */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return 'localhost';
  }
})();

/** Builds an absolute URL from a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─── Contact details ────────────────────────────────────────

/**
 * Public contact mailbox. Also the recipient of internal order/payment
 * notification e-mails. Leave blank to hide every "contact us by e-mail" UI.
 */
export const CONTACT_EMAIL = env(process.env.NEXT_PUBLIC_CONTACT_EMAIL);

/** Contact phone in E.164 (e.g. `+972500000000`). Blank hides phone/WhatsApp UI. */
export const CONTACT_PHONE_E164 = env(process.env.NEXT_PUBLIC_CONTACT_PHONE);

/** Human-readable phone for display. Falls back to the E.164 value. */
export const CONTACT_PHONE_DISPLAY = env(
  process.env.NEXT_PUBLIC_CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
);

/** `wa.me` deep link derived from the contact phone. Blank when no phone is set. */
export const WHATSAPP_URL = CONTACT_PHONE_E164
  ? `https://wa.me/${CONTACT_PHONE_E164.replace(/[^0-9]/g, '')}`
  : '';

// ─── Social profiles (blank = link hidden) ──────────────────

export const SOCIAL_INSTAGRAM_URL = env(process.env.NEXT_PUBLIC_INSTAGRAM_URL);
export const SOCIAL_FACEBOOK_URL = env(process.env.NEXT_PUBLIC_FACEBOOK_URL);

/** Every configured social profile, for `schema.org` `sameAs`. */
export const SOCIAL_PROFILES: string[] = [
  SOCIAL_INSTAGRAM_URL,
  SOCIAL_FACEBOOK_URL,
].filter(Boolean);

// ─── Legal operator identity ────────────────────────────────

/**
 * The legal entity that operates the service, as it must appear in the terms,
 * privacy, cookies and B2B agreement pages (e.g. "Acme Ltd."). Defaults to the
 * brand name so the legal pages stay coherent out of the box.
 *
 * NOTE: the bundled legal pages are Hebrew templates written for an Israeli
 * sole-trader. They are NOT legal advice - have a lawyer review them and adapt
 * them to your jurisdiction before charging real customers.
 */
export const LEGAL_ENTITY_NAME = env(
  process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME,
  BRAND_NAME,
);

/**
 * Optional legal form / registration descriptor rendered right after the
 * entity name (e.g. "עוסק פטור", "Ltd., company no. 123456").
 */
export const LEGAL_ENTITY_FORM = env(process.env.NEXT_PUBLIC_LEGAL_ENTITY_FORM);

/** `"<entity>, <form>"` or just `"<entity>"` when no legal form is configured. */
export const LEGAL_OPERATOR = LEGAL_ENTITY_FORM
  ? `${LEGAL_ENTITY_NAME}, ${LEGAL_ENTITY_FORM}`
  : LEGAL_ENTITY_NAME;

/** Named person handling accessibility enquiries. Falls back to the operator. */
export const ACCESSIBILITY_CONTACT_NAME = env(
  process.env.NEXT_PUBLIC_ACCESSIBILITY_CONTACT_NAME,
  LEGAL_ENTITY_NAME,
);

// ─── Brand assets ───────────────────────────────────────────

/**
 * Absolute logo URLs. E-mail clients cannot resolve relative paths, so these
 * must point at a publicly reachable origin - by default the site itself.
 */
export const LOGO_LIGHT_URL = absoluteUrl('/icons/Eventa_Logo.png');
export const LOGO_DARK_URL = absoluteUrl('/icons/Eventa_Logo_Dark.png');
export const LOGO_SQUARE_URL = absoluteUrl('/icons/icon-512x512.png');

// ─── Analytics (blank = tag not injected at all) ────────────

/** Google Ads conversion ID, e.g. `AW-XXXXXXXXXX`. */
export const GOOGLE_ADS_ID = env(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);

/** Google Analytics 4 measurement ID, e.g. `G-XXXXXXXXXX`. */
export const GA_MEASUREMENT_ID = env(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

/** True when any Google tag should be loaded. */
export const ANALYTICS_ENABLED = Boolean(GOOGLE_ADS_ID || GA_MEASUREMENT_ID);
