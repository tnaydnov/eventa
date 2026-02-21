import DOMPurify from 'dompurify';

/**
 * Sanitize user input — strips HTML/JS while preserving text content.
 * Safe for chat messages, bios, display names, etc.
 */
export function sanitize(input: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip ALL tags first, then decode entities.
    // Order: strip tags FIRST to prevent entity-decoded payloads from becoming live HTML.
    return input
      .replace(/<[^>]*>/g, '')          // strip tags from raw markup
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/<[^>]*>/g, '')          // second pass: strip any tags created by decoded entities
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
