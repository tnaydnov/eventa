'use client';

/**
 * Static phone mockup that shows how the grid page looks
 * with the chosen background (default dark or custom image).
 * Pixel-accurate match to the real app's layout and colors.
 */
interface Props {
  backgroundPreview: string | null;
  wantsCustomBackground: boolean;
  eventName?: string;
}

export default function BackgroundPreview({ backgroundPreview, wantsCustomBackground, eventName }: Props) {
  const hasCustomBg = wantsCustomBackground && !!backgroundPreview;

  return (
    <div className="bg-preview" aria-hidden="true">
      <p className="bg-preview__label">תצוגה מקדימה</p>
      <div className="bg-preview__phone">
        {/* Notch */}
        <div className="bg-preview__notch" />

        {/* Background layer */}
        {hasCustomBg && (
          <div className="bg-preview__custom-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundPreview!} alt="" />
            <div className="bg-preview__custom-overlay" />
          </div>
        )}

        {/* ── Header ── */}
        <div className="bg-preview__header">
          <h3 className="bg-preview__title">{eventName || 'Dana & Itai'}</h3>
          <div className="bg-preview__profile-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>

        {/* ── View toggle ── */}
        <div className="bg-preview__toggle-row">
          <div className="bg-preview__toggle-pill">
            <span className="bg-preview__toggle-btn bg-preview__toggle-btn--active">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <span className="bg-preview__toggle-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="4" y="3" width="16" height="18" rx="3" />
                <path d="M8 21h8" />
              </svg>
            </span>
          </div>
        </div>

        {/* ── Empty state (so background is visible) ── */}
        <div className="bg-preview__empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p>אין משתתפים להצגה כרגע</p>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-preview__tabbar">
          {/* Grid (active) - rightmost in RTL */}
          <div className="bg-preview__tab bg-preview__tab--active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>גריד</span>
          </div>
          {/* Chats - middle */}
          <div className="bg-preview__tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>צ׳אטים</span>
          </div>
          {/* Likes - leftmost in RTL */}
          <div className="bg-preview__tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span>לייקים</span>
          </div>
        </div>
      </div>
    </div>
  );
}
