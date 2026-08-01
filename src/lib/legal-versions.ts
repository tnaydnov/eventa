/**
 * Versioned identifiers for the legal documents users consent to.
 *
 * These are the SOURCE OF TRUTH for consent logging. Whenever the substantive
 * content of a legal document changes, bump its version here so that consent
 * records remain traceable to the exact text a user agreed to.
 *
 * Format: ISO date (YYYY-MM-DD) of the last substantive revision.
 */
export const TERMS_VERSION = '2026-06-13';
export const PRIVACY_VERSION = '2026-06-13';
export const COOKIES_VERSION = '2026-06-13';

/** Version of the B2B / order terms (paying-client agreement). */
export const BUSINESS_TERMS_VERSION = '2026-06-13';

/**
 * Exact Hebrew declaration the paying customer confirms before providing
 * guest phone numbers (guest-list upload portal). Bump GUEST_PHONE_CONSENT_VERSION
 * if this wording changes.
 */
export const GUEST_PHONE_CONSENT_VERSION = '2026-06-13';
export const GUEST_PHONE_CONSENT_TEXT =
  'אני מצהיר/ה כי יש לי הרשאה למסור ל-Eventa את מספרי הטלפון של האורחים לצורך שליחת הודעות שירות הקשורות לאירוע, וכי ידוע לי שהמספרים ישמשו למטרה זו בלבד ובהתאם למדיניות הפרטיות.';
