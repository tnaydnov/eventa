/**
 * WizardIcons - Professional SVG icons for the order wizard.
 *
 * Renders a monochrome SVG for a given icon key. All icons are designed
 * to match the Rose-Gold Luxe aesthetic: thin strokes, soft curves,
 * elegant proportions. Uses `currentColor` so the surrounding CSS
 * controls the color.
 *
 * To add an icon: add a case to the switch and it's instantly available
 * via <WizardIcon name="your-key" />.
 */

interface Props {
  name: string;
  size?: number;
  className?: string;
}

export default function WizardIcon({ name, size = 24, className }: Props) {
  const s = { width: size, height: size, display: 'block' as const };
  const a11y = { 'aria-hidden': true as const, focusable: 'false' as const };

  switch (name) {
    /* ג”€ג”€ Event Types ג”€ג”€ */

    case 'rings':
      // Two interlocking rings - wedding
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <circle cx="9" cy="13" r="5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15" cy="13" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5l1 3M16 5l-1 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="4.5" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="16" cy="4.5" r="1" fill="currentColor" opacity="0.6" />
        </svg>
      );

    case 'glass':
      // Champagne glass - party
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M8 2h8l-1.5 8a2.5 2.5 0 01-5 0L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="12" y1="12" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 5h4" stroke="currentColor" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
        </svg>
      );

    case 'building':
      // Modern building - corporate
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="7" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="13" y="7" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="8" y="12" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="13" y="12" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10 21v-3.5a2 2 0 014 0V21" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'people':
      // Two people - meetup
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M21 20c0-2.5-1.8-4.5-4-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case 'sparkle':
      // Four-point sparkle - other/generic
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M12 2l1.5 6.5L20 12l-6.5 1.5L12 22l-1.5-6.5L4 12l6.5-3.5L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M19 3l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5L19 3z" stroke="currentColor" strokeWidth="1" opacity="0.5" strokeLinejoin="round" />
        </svg>
      );

    /* ג”€ג”€ Step Icons (progress rail) ג”€ג”€ */

    case 'grid':
      // Grid/apps icon - type selection step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'calendar':
      // Calendar - details step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="4" width="18" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.5" />
        </svg>
      );

    case 'palette':
      // Palette - background step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M12 2a10 10 0 000 20c1.1 0 2-.9 2-2v-1c0-.6.2-1.1.6-1.5.4-.4 1-.6 1.5-.6H18a4 4 0 004-4 10 10 0 00-10-10z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7.5" cy="11" r="1.5" fill="currentColor" opacity="0.5" />
          <circle cx="10" cy="7.5" r="1.5" fill="currentColor" opacity="0.4" />
          <circle cx="15" cy="7.5" r="1.5" fill="currentColor" opacity="0.6" />
        </svg>
      );

    case 'frame':
      // Picture frame - poster step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );

    case 'chat':
      // Chat bubble - messages step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M21 12c0 4.4-4 8-9 8-1.6 0-3.1-.3-4.4-1L3 21l1.8-4A7.4 7.4 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1="8" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );

    case 'check':
      // Checkmark circle - summary step
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    /* ג”€ג”€ Toggle & Utility Icons ג”€ג”€ */

    case 'moon':
      // Crescent moon - default background
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );

    case 'brush':
      // Paintbrush - custom background
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M18.4 2.6a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L10 17H6v-4L18.4 2.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6 17c-2 2-3 3-3 4.5S4.3 23 5 23s3-.8 3-2.5S8 17 6 17z" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );

    case 'upload':
      // Upload arrow - file upload
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M12 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 17v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'qr':
      // QR code pattern - QR-only option
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="5.5" y="5.5" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="16.5" y="5.5" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="5.5" y="16.5" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="14" y="14" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="19" y="14" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
          <rect x="14" y="19" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
          <rect x="19" y="19" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        </svg>
      );

    case 'x-circle':
      // X in circle - no/decline
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'phone':
      // Phone - call-me contact pref
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014 2h3a2 2 0 012 1.7 12.8 12.8 0 00.7 2.8 2 2 0 01-.4 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4 12.8 12.8 0 002.8.7A2 2 0 0122 16.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );

    case 'link':
      // Chain link - send-link contact pref
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.8 1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.8-1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'paperclip':
      // Paperclip - attachment indicator
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <path d="M21.4 11.6l-8.5 8.5a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4L16 7.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'image':
      // Image/photo - template poster indicator
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M21 16l-5-5-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'lock':
      // Lock - secure payment
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    default:
      // Fallback - small dot
      return (
        <svg viewBox="0 0 24 24" fill="none" style={s} className={className} {...a11y}>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4" />
        </svg>
      );
  }
}
