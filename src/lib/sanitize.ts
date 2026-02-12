import DOMPurify from 'dompurify';

/**
 * Sanitize user input — strips HTML/JS while preserving text content.
 * Safe for chat messages, bios, display names, etc.
 */
export function sanitize(input: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML tags with regex fallback
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  // Client-side: use DOMPurify which handles all edge cases
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [], // No attributes allowed
  }).trim();
}

/**
 * Sanitize text and enforce max length.
 */
export function sanitizeWithLimit(input: string, maxLength: number): string {
  const clean = sanitize(input);
  return clean.slice(0, maxLength);
}
