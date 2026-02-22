'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

/**
 * /dating/event-over
 * Marketing-style "event ended" splash page.
 * Shown to QR scanners when the event is no longer active.
 * Auto-redirects to /dating landing page after 7 seconds.
 *
 * Query params: ?reason=ended|paused|archived
 */

const REDIRECT_SECONDS = 7;

const REASON_CONFIG: Record<string, { emoji: string; headline: string; sub: string }> = {
  ended: {
    emoji: '🎉',
    headline: 'האירוע הסתיים!',
    sub: 'תודה שהגעתם — מקווים שנהניתם ויצרתם חיבורים מדהימים',
  },
  paused: {
    emoji: '⏸️',
    headline: 'האירוע מושהה כרגע',
    sub: 'מנהל האירוע השהה את הפעילות זמנית. בדקו שוב בקרוב!',
  },
  archived: {
    emoji: '📦',
    headline: 'האירוע הסתיים',
    sub: 'האירוע כבר לא פעיל, אבל אנחנו עדיין כאן',
  },
};

const DEFAULT_CONFIG = {
  emoji: '🎉',
  headline: 'האירוע הסתיים!',
  sub: 'תודה שהגעתם — מקווים שנהניתם',
};

export default function EventOverPage() {
  return (
    <Suspense fallback={
      <div className="event-over-page">
        <div className="event-over-blob event-over-blob--1" />
        <div className="event-over-blob event-over-blob--2" />
        <div className="event-over-blob event-over-blob--3" />
      </div>
    }>
      <EventOverContent />
    </Suspense>
  );
}

function EventOverContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? 'ended';
  const config = REASON_CONFIG[reason] ?? DEFAULT_CONFIG;

  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = Date.now();
    const total = REDIRECT_SECONDS * 1000;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((total - elapsed) / 1000));
      const pct = Math.min(100, (elapsed / total) * 100);

      setCountdown(remaining);
      setProgress(pct);

      if (elapsed >= total) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.location.href = '/dating';
      }
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="event-over-page">
      {/* Animated background blobs */}
      <div className="event-over-blob event-over-blob--1" />
      <div className="event-over-blob event-over-blob--2" />
      <div className="event-over-blob event-over-blob--3" />

      <div className="event-over-content">
        {/* Logo */}
        <div className="event-over-logo">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={120}
            height={120}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        {/* Emoji with pulse */}
        <div className="event-over-emoji">{config.emoji}</div>

        {/* Headline */}
        <h1 className="event-over-headline">{config.headline}</h1>
        <p className="event-over-sub">{config.sub}</p>

        {/* Divider */}
        <div className="event-over-divider" />

        {/* Marketing CTA */}
        <div className="event-over-cta-section">
          <p className="event-over-cta-text">
            רוצים חוויה כזו גם באירוע שלכם?
          </p>
          <p className="event-over-cta-desc">
            Eventa מביאה שכבת היכרויות חכמה לחתונות, מסיבות ואירועים —
            <br />
            סריקת QR, פרופילים, לייקים, מאצ׳ים וצ׳אט. הכל בדפדפן.
          </p>
          <a href="/dating" className="event-over-btn">
            גלו את Eventa
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 4l-6 6 6 6" />
            </svg>
          </a>
        </div>

        {/* Countdown */}
        <div className="event-over-countdown">
          <div className="event-over-countdown-bar">
            <div
              className="event-over-countdown-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="event-over-countdown-text">
            {countdown > 0
              ? `מועברים לעמוד הראשי בעוד ${countdown} שניות...`
              : 'מעביר...'}
          </span>
        </div>
      </div>
    </div>
  );
}
