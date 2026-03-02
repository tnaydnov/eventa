'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  WIZARD_STEPS,
  WIZARD_TYPE_MAP,
  INITIAL_WIZARD_STATE,
  type WizardFormState,
} from './wizard-config';
import StepEventType from './steps/StepEventType';
import StepEventDetails from './steps/StepEventDetails';
import StepBackground from './steps/StepBackground';
import StepPoster from './steps/StepPoster';
import StepMessages from './steps/StepMessages';
import StepSummary from './steps/StepSummary';
import WizardIcon from './WizardIcons';

// ─── Helpers ────────────────────────────────────────────

/** Generate a random particle */
function makeParticle(i: number) {
  const size = 1.5 + Math.random() * 2.5;
  return {
    id: i,
    left: `${5 + Math.random() * 90}%`,
    bottom: `${-5 + Math.random() * 15}%`,
    width: size,
    height: size,
    delay: `${Math.random() * 8}s`,
    duration: `${6 + Math.random() * 10}s`,
    opacity: 0.15 + Math.random() * 0.35,
  };
}

const PARTICLES = Array.from({ length: 20 }, (_, i) => makeParticle(i));

// ─── Validation ─────────────────────────────────────────

function validateStep(step: number, state: WizardFormState): string | null {
  switch (step) {
    case 0:
      if (!state.eventType) return 'יש לבחור סוג אירוע';
      return null;

    case 1: {
      const tc = WIZARD_TYPE_MAP[state.eventType];
      if (tc?.nameField.required && !state.eventName.trim()) {
        return `${tc.nameField.label.replace(' *', '')} הוא שדה חובה`;
      }
      if (!state.startsAt) return 'יש לבחור תאריך ושעת התחלה';
      if (!state.endsAt) return 'יש לבחור תאריך ושעת סיום';
      if (state.endsAt <= state.startsAt) return 'שעת הסיום חייבת להיות אחרי ההתחלה';
      return null;
    }

    case 2:
      if (state.wantsCustomBackground && !state.backgroundBase64) {
        return 'בחרתם רקע מותאם - יש להעלות תמונה לפני שממשיכים';
      }
      return null;

    case 3:
      // Poster is fully optional (qr-only is valid)
      return null;

    case 4:
      // Messages toggle - no validation needed
      return null;

    case 5:
      if (!state.contactName.trim()) return 'יש למלא שם מלא';
      if (!state.contactPhone.trim()) return 'יש למלא מספר טלפון';
      if (!/^[\d\s+\-()]{7,}$/.test(state.contactPhone.trim())) {
        return 'מספר טלפון לא תקין';
      }
      if (state.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contactEmail)) {
        return 'כתובת אימייל לא תקינה';
      }
      return null;

    default:
      return null;
  }
}

// ─── Component ──────────────────────────────────────────

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardFormState>(INITIAL_WIZARD_STATE);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const totalSteps = WIZARD_STEPS.length;

  // Merge patch into state
  const onChange = useCallback((patch: Partial<WizardFormState>) => {
    setState(prev => ({ ...prev, ...patch }));
    setError(null);
  }, []);

  // Navigation
  const goNext = useCallback(() => {
    const err = validateStep(step, state);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(s => Math.min(s + 1, totalSteps - 1));
  }, [step, state, totalSteps]);

  const goBack = useCallback(() => {
    setError(null);
    setStep(s => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback((target: number) => {
    setError(null);
    setStep(target);
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    const err = validateStep(step, state);
    if (err) {
      setError(err);
      return;
    }

    setSending(true);
    setError(null);

    try {
      const payload = {
        // Existing simple fields (backward-compatible)
        eventType: state.eventType,
        eventDate: state.startsAt.split('T')[0] || state.startsAt,
        contactName: state.contactName,
        contactPhone: state.contactPhone,
        contactEmail: state.contactEmail || '',
        // Extended wizard fields
        eventName: state.eventName,
        startsAt: state.startsAt,
        endsAt: state.endsAt,
        wantsCustomBackground: state.wantsCustomBackground,
        backgroundBase64: state.wantsCustomBackground ? state.backgroundBase64 : null,
        posterChoice: state.posterChoice,
        selectedTemplateId: state.selectedTemplateId,
        specialRequests: state.specialRequests,
        wantsGuestMessages: false,
        contactPreference: state.contactPreference,
        source: 'wizard',
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }

      setSuccess(true);
    } catch {
      setError('שגיאה בשליחה. נסו שוב או פנו אלינו ישירות.');
    } finally {
      setSending(false);
    }
  }, [step, state]);

  // Whether the current step's "next" should be enabled
  const isLastStep = step === totalSteps - 1;

  // Progress bar fill percentage
  const progressPercent = useMemo(
    () => (step / (totalSteps - 1)) * 100,
    [step, totalSteps]
  );

  // ── Success screen ──
  if (success) {
    return (
      <div className="wiz-page" dir="rtl">
        <div className="wiz-ambient" />
        <div className="wiz-particles">
          {PARTICLES.map(p => (
            <span
              key={p.id}
              className="wiz-particle"
              style={{
                left: p.left,
                bottom: p.bottom,
                width: p.width,
                height: p.height,
                animationDelay: p.delay,
                animationDuration: p.duration,
                opacity: p.opacity,
              }}
            />
          ))}
        </div>
        <div className="wiz-success">
          <div className="wiz-success__ring">
            <svg className="wiz-success__check" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="wiz-success__title">ההזמנה נשלחה בהצלחה!</h2>
          <p className="wiz-success__text">
            קיבלנו את כל הפרטים ונחזור אליכם בהקדם.
            {state.contactPreference === 'call-me'
              ? ' נפנה אליכם תוך 48 שעות.'
              : ' נשלח לכם לינק לתשלום בהקדם.'}
          </p>
          <Link href="/dating" className="wiz-success__btn">
            חזרה לדף הראשי
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M7 4l-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  // ── Main wizard ──
  return (
    <div className="wiz-page" dir="rtl">
      <h1 className="sr-only">הזמנת Eventa Dating לאירוע</h1>
      {/* Ambient background */}
      <div className="wiz-ambient" />

      {/* Floating particles */}
      <div className="wiz-particles">
        {PARTICLES.map(p => (
          <span
            key={p.id}
            className="wiz-particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.width,
              height: p.height,
              animationDelay: p.delay,
              animationDuration: p.duration,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="wiz-header">
        {step > 0 ? (
          <button type="button" className="wiz-back" onClick={goBack} aria-label="חזרה">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M13 4l6 6-6 6" />
            </svg>
          </button>
        ) : (
          <Link href="/dating" className="wiz-back" aria-label="חזרה לדף הראשי">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M13 4l6 6-6 6" />
            </svg>
          </Link>
        )}
        <Link href="/dating" className="wiz-header__logo">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={80}
            height={26}
            style={{ objectFit: 'contain' }}
          />
        </Link>
        {/* Invisible spacer to balance the back button for centering */}
        <span className="wiz-header__spacer" />
      </div>

      {/* Progress rail */}
      <div className="wiz-progress">
        <div className="wiz-progress__track">
          <div className="wiz-progress__line">
            <div
              className="wiz-progress__fill"
              style={{ '--progress': progressPercent / 100 } as React.CSSProperties}
            />
          </div>
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`wiz-progress__node${
                i < step ? ' wiz-progress__node--done' : ''
              }${i === step ? ' wiz-progress__node--active' : ''}`}
            >
              <div className="wiz-progress__dot">
                {i < step ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
                    <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <WizardIcon name={s.icon} size={16} />
                )}
              </div>
              <span className="wiz-progress__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="wiz-card" key={step}>
        {step === 0 && <StepEventType state={state} onChange={onChange} />}
        {step === 1 && <StepEventDetails state={state} onChange={onChange} />}
        {step === 2 && <StepBackground state={state} onChange={onChange} />}
        {step === 3 && <StepPoster state={state} onChange={onChange} />}
        {step === 4 && <StepMessages />}
        {step === 5 && <StepSummary state={state} onChange={onChange} onGoToStep={goToStep} />}

        {error && <p className="wiz-error" role="alert">{error}</p>}
      </div>

      {/* Navigation buttons */}
      <div className="wiz-nav">
        <button
          type="button"
          className="wiz-nav__btn wiz-nav__btn--back"
          onClick={goBack}
          disabled={step === 0}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
            <path d="M13 4l6 6-6 6" />
          </svg>
          הקודם
        </button>

        {isLastStep ? (
          <button
            type="button"
            className="wiz-nav__btn wiz-nav__btn--submit"
            onClick={handleSubmit}
            disabled={sending}
          >
            {sending ? 'שולח...' : 'שלחו הזמנה'}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M5 10h10M10 5l5 5-5 5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="wiz-nav__btn wiz-nav__btn--next"
            onClick={goNext}
          >
            הבא
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M7 4l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
