'use client';

import type { Route } from 'next';
import Link from 'next/link';
import SitePageLayout from '@/components/SitePageLayout';
import { PhoneScreen } from './phone-screens';
import { useStoryPlayer } from './useStoryPlayer';

export default function HowItWorksPage() {
  const {
    journey, step, steps, current,
    transitioning, paused,
    goTo, next, prev, switchJourney, togglePause,
  } = useStoryPlayer();

  const tabPanelId = 'hiw-story-panel';
  const tabId = (j: 'organizer' | 'guest') => `hiw-tab-${j}`;

  return (
    <SitePageLayout full className="hiw">
      <div className="hiw__content">

        {/* ═══ Hero ═══ */}
        <div className="hiw__hero">
          <h1 className="hiw__title">איך Eventa עובדת?</h1>
          <p className="hiw__subtitle">
            מהרגע שאתם מזמינים - ועד הרגע שהאורחים שלכם מוצאים את הלב.<br />
            צפו בחוויה דרך שני הצדדים.
          </p>
        </div>

        {/* ═══ Journey toggle ═══ */}
        <div className="hiw__toggle" role="tablist" aria-label="בחירת נקודת מבט">
          <button
            id={tabId('organizer')}
            role="tab"
            aria-selected={journey === 'organizer'}
            aria-controls={tabPanelId}
            className={`hiw__toggle-btn${journey === 'organizer' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('organizer')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
            <span>העיניים של המארגן</span>
          </button>
          <button
            id={tabId('guest')}
            role="tab"
            aria-selected={journey === 'guest'}
            aria-controls={tabPanelId}
            className={`hiw__toggle-btn${journey === 'guest' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('guest')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
            <span>העיניים של האורח</span>
          </button>
        </div>

        {/* ═══ Story viewer ═══ */}
        <div id={tabPanelId} className="hiw__story" role="tabpanel" aria-labelledby={tabId(journey)}>

          {/* ── Progress bars (IG-style) ── */}
          <div className="hiw__progress" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
            {steps.map((_, i) => (
              <div key={i} className="hiw__progress-track">
                <div
                  className={`hiw__progress-fill${i < step ? ' hiw__progress-fill--done' : i === step ? ' hiw__progress-fill--active' : ''}`}
                  style={i === step ? { animationDuration: paused ? '0s' : '6s', animationPlayState: paused ? 'paused' : 'running' } : undefined}
                />
              </div>
            ))}
            <button
              className="hiw__pause-btn"
              onClick={togglePause}
              aria-label={paused ? 'המשך הצגה אוטומטית' : 'השהה הצגה אוטומטית'}
            >
              {paused ? '▶' : '⏸'}
            </button>
          </div>

          {/* ── Main layout: text + phone ── */}
          <div className="hiw__stage">

            {/* Text side */}
            <div className={`hiw__text${transitioning ? ' hiw__text--out' : ''}`} aria-live="polite">
              <div className="hiw__step-badge">{step + 1}</div>
              <h2 className="hiw__step-title">{current.title}</h2>
              <p className="hiw__step-desc">{current.desc}</p>
              <div className="hiw__step-counter">
                {step + 1} / {steps.length}
              </div>
            </div>

            {/* Phone side - decorative mockup, hidden from screen readers */}
            <div className="hiw__phone-wrap" aria-hidden="true">
              <div className="hiw__phone">
                <div className="hiw__phone-notch" />
                <div className={`hiw__phone-screen${transitioning ? ' hiw__phone-screen--out' : ''}`}>
                  <PhoneScreen screen={current.screen} />
                </div>
              </div>
            </div>

          </div>

          {/* ── Navigation arrows ── */}
          <div className="hiw__nav">
            <button
              className="hiw__nav-btn"
              onClick={prev}
              disabled={step === 0}
              aria-label="הקודם"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button
              className="hiw__nav-btn"
              onClick={next}
              disabled={step === steps.length - 1}
              aria-label="הבא"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          </div>

          {/* ── Tap zones (click left/right of phone) ── */}
          <button className="hiw__tap hiw__tap--prev" onClick={prev} aria-label="הקודם" tabIndex={-1} />
          <button className="hiw__tap hiw__tap--next" onClick={next} aria-label="הבא" tabIndex={-1} />
        </div>

        {/* ═══ CTA ═══ */}
        <div className="hiw__cta">
          <h2 className="hiw__cta-title">מוכנים?</h2>
          <p className="hiw__cta-sub">
            הפעילו את Eventa באירוע שלכם ותנו לאורחים חוויה שהם יזכרו.
          </p>
          <Link href={'/order' as Route} className="hiw__cta-btn">
            <span>להזמנה</span>
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        </div>

      </div>
    </SitePageLayout>
  );
}
