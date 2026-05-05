import type { CSSProperties } from 'react';

interface PremiumSplashScreenProps {
  /** Status text shown under the logo (Hebrew). */
  subtitle?: string;
  /** Hide shimmer for purely informational splashes. */
  hideShimmer?: boolean;
  /** ARIA label for the live region. */
  ariaLabel?: string;
  /** Optional inline style override for the outer wrapper. */
  style?: CSSProperties;
}

/**
 * PremiumSplashScreen
 * ───────────────────
 * Branded, full-screen Eventa splash used during every loading / checking /
 * redirecting / verifying state in the join flow. CSS-only animations so it
 * is safe in server components (e.g. Next.js loading.tsx).
 */
export default function PremiumSplashScreen({
  subtitle = 'טוענים את חוויית האירוע...',
  hideShimmer = false,
  ariaLabel,
  style,
}: PremiumSplashScreenProps) {
  return (
    <div className="pj-bg" style={style} dir="rtl">
      <div
        className="pj-stage"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={ariaLabel || subtitle}
      >
        <div className="pj-splash-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            className="pj-splash-logo"
            width={148}
            height={148}
            draggable={false}
            decoding="async"
            {...({ fetchpriority: 'high' } as Record<string, string>)}
          />
        </div>

        {subtitle && <p className="pj-splash-sub">{subtitle}</p>}

        {!hideShimmer && <div className="pj-splash-shimmer" aria-hidden="true" />}
      </div>
    </div>
  );
}
