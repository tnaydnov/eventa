'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

/**
 * /dating/event-over
 * Cinematic "event ended" splash - full-screen atmospheric experience.
 * Auto-redirects to /dating after 15 seconds.
 *
 * Query params: ?reason=ended|paused|archived
 */

const REDIRECT_SECONDS = 15;

/** SVG ring circumference = 2 * π * radius(17) */
const RING_CIRCUMFERENCE = 2 * Math.PI * 17;

type EventOverReason = 'ended' | 'paused' | 'archived';

const REASON_COPY: Record<EventOverReason, { line1: string; line2: string; sub: string }> = {
  ended: {
    line1: 'הערב הזה',
    line2: 'כבר הפך לזיכרון',
    sub: 'החיבורים נוצרו, הרגעים נשמרו. תודה שהייתם חלק מזה.',
  },
  paused: {
    line1: 'רגע של',
    line2: 'השהייה',
    sub: 'האירוע מושהה זמנית. נחזור בקרוב - שווה לבדוק שוב.',
  },
  archived: {
    line1: 'הסיפור הזה',
    line2: 'כבר נכתב',
    sub: 'האירוע הסתיים, אבל החיבורים שנוצרו ממשיכים.',
  },
};

const DEFAULT_COPY = {
  line1: 'הערב הזה',
  line2: 'כבר הפך לזיכרון',
  sub: 'תודה שהייתם חלק מזה.',
};

/** Generate deterministic floating particle positions */
function generateParticles(count: number) {
  const particles: Array<{ x: number; y: number; size: number; delay: number; duration: number }> = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: ((i * 37 + 13) % 100),
      y: ((i * 53 + 7) % 100),
      size: 1.5 + (i % 4) * 0.8,
      delay: (i * 0.7) % 8,
      duration: 6 + (i % 5) * 2,
    });
  }
  return particles;
}

const PARTICLES = generateParticles(30);

export default function EventOverPage() {
  return (
    <Suspense fallback={<div className="eo" />}>
      <EventOverContent />
    </Suspense>
  );
}

function EventOverContent() {
  const searchParams = useSearchParams();
  const rawReason = searchParams.get('reason') ?? 'ended';
  const copy = (rawReason in REASON_COPY)
    ? REASON_COPY[rawReason as EventOverReason]
    : DEFAULT_COPY;

  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Stagger the reveal
    requestAnimationFrame(() => setRevealed(true));
  }, []);

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

  const handleSkip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    window.location.href = '/dating';
  }, []);

  return (
    <main id="main-content" className={`eo${revealed ? ' eo--revealed' : ''}`}>
      {/* Ambient light layer */}
      <div className="eo__ambient" />

      {/* Floating particles */}
      <div className="eo__particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="eo__particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Horizontal accent line */}
      <div className="eo__line" />

      {/* Main content - vertically centered */}
      <div className="eo__center">
        {/* Logo - small, subtle */}
        <div className="eo__logo">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={200}
            height={200}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        {/* Typography - large, cinematic, two lines */}
        <h1 className="eo__title">
          <span className="eo__title-line eo__title-line--1">{copy.line1}</span>
          <span className="eo__title-line eo__title-line--2">{copy.line2}</span>
        </h1>

        <p className="eo__sub">{copy.sub}</p>

        {/* Thin separator */}
        <div className="eo__sep" />

        {/* CTA block */}
        <div className="eo__cta">
          <p className="eo__cta-label">האירוע הבא יכול להיות שלכם</p>
          <a href="/dating" className="eo__btn" onClick={(e) => { e.preventDefault(); handleSkip(); }}>
            <span>גלו עוד</span>
            <svg className="eo__btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
        </div>
      </div>

      {/* Bottom: progress ring + countdown */}
      <div className="eo__bottom" role="timer" aria-live="polite" aria-label={`מועברים לאתר הראשי בעוד ${countdown} שניות`}>
        <div className="eo__timer">
          <svg className="eo__ring" viewBox="0 0 40 40">
            <circle className="eo__ring-bg" cx="20" cy="20" r="17" />
            <circle
              className="eo__ring-fill"
              cx="20" cy="20" r="17"
              style={{ strokeDashoffset: `${RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE}` }}
            />
          </svg>
          <span className="eo__timer-num">{countdown}</span>
        </div>
        <span className="eo__timer-label">מועברים לאתר הראשי</span>
      </div>
    </main>
  );
}
