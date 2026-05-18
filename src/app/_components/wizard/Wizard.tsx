'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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

/** Deterministic pseudo-random based on seed (avoids hydration mismatch) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** Generate a deterministic particle */
function makeParticle(i: number) {
  const r = (offset: number) => seededRandom(i * 6 + offset);
  const size = 1.5 + r(0) * 2.5;
  return {
    id: i,
    left: `${5 + r(1) * 90}%`,
    bottom: `${-5 + r(2) * 15}%`,
    width: size,
    height: size,
    delay: `${r(3) * 8}s`,
    duration: `${6 + r(4) * 10}s`,
    opacity: 0.15 + r(5) * 0.35,
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
      const tc = state.eventType ? WIZARD_TYPE_MAP[state.eventType] : undefined;
      if (tc?.nameField.required && !state.eventName.trim()) {
        return `${tc.nameField.label.replace(' *', '')} הוא שדה חובה`;
      }
      if (!state.startsAt) return 'יש לבחור תאריך ושעת התחלה';
      if (!state.endsAt) return 'יש לבחור תאריך ושעת סיום';
      if (new Date(state.startsAt) < new Date()) return 'תאריך ההתחלה חייב להיות בעתיד';
      if (new Date(state.endsAt) <= new Date(state.startsAt)) return 'שעת הסיום חייבת להיות אחרי ההתחלה';
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
      if (state.contactPreference === 'pay-now' && !state.contactEmail?.trim()) {
        return 'יש למלא כתובת אימייל לקבלת קבלה ופרטי אירוע';
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
  const [paymentSkipped, setPaymentSkipped] = useState(false);

  const searchParams = useSearchParams();

  // Detect return from payment redirect
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setSuccess(true);
      window.history.replaceState({}, '', '/order');
    } else if (payment === 'cancelled') {
      setError('התשלום בוטל. ניתן לנסות שוב.');
      window.history.replaceState({}, '', '/order');
    } else if (payment === 'error') {
      setError('אירעה שגיאה בתשלום. ניתן לנסות שוב.');
      window.history.replaceState({}, '', '/order');
    }
  }, [searchParams]);

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
      // ── Pay-now: go directly to payment (order created on success) ──
      if (state.contactPreference === 'pay-now') {
        const sessionRes = await fetch('/api/payment/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactName: state.contactName,
            contactPhone: state.contactPhone,
            contactEmail: state.contactEmail,
            eventType: state.eventType,
            eventName: state.eventName,
            startsAt: state.startsAt,
            endsAt: state.endsAt,
            wantsCustomBackground: state.wantsCustomBackground,
            backgroundBase64: state.wantsCustomBackground ? state.backgroundBase64 : null,
            posterChoice: state.posterChoice,
            selectedTemplateId: state.selectedTemplateId,
            specialRequests: state.specialRequests,
            wantsGuestMessages: state.wantsGuestMessages,
          }),
        });

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.paymentUrl) {
            window.location.href = sessionData.paymentUrl;
            return; // User will be redirected back after payment
          }
        }
        // Payment session failed — save order with manual follow-up status
        const fallbackRes = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: state.eventType,
            eventDate: state.startsAt.split('T')[0] || state.startsAt,
            contactName: state.contactName,
            contactPhone: state.contactPhone,
            contactEmail: state.contactEmail || '',
            eventName: state.eventName,
            startsAt: state.startsAt,
            endsAt: state.endsAt,
            wantsCustomBackground: state.wantsCustomBackground,
            backgroundBase64: state.wantsCustomBackground ? state.backgroundBase64 : null,
            posterChoice: state.posterChoice,
            selectedTemplateId: state.selectedTemplateId,
            specialRequests: state.specialRequests,
            wantsGuestMessages: state.wantsGuestMessages,
            contactPreference: 'call-me',
            source: 'wizard-payment-fallback',
          }),
        });

        if (!fallbackRes.ok) {
          throw new Error('Payment and fallback order both failed');
        }

        setPaymentSkipped(true);
        setSuccess(true);
        return;
      }

      // ── Non-pay-now flows (call-me / send-link): save order via /api/order ──
      const payload = {
        eventType: state.eventType,
        eventDate: state.startsAt.split('T')[0] || state.startsAt,
        contactName: state.contactName,
        contactPhone: state.contactPhone,
        contactEmail: state.contactEmail || '',
        eventName: state.eventName,
        startsAt: state.startsAt,
        endsAt: state.endsAt,
        wantsCustomBackground: state.wantsCustomBackground,
        backgroundBase64: state.wantsCustomBackground ? state.backgroundBase64 : null,
        posterChoice: state.posterChoice,
        selectedTemplateId: state.selectedTemplateId,
        specialRequests: state.specialRequests,
        wantsGuestMessages: state.wantsGuestMessages,
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
          <h2 className="wiz-success__title">
            {state.contactPreference === 'pay-now' && !paymentSkipped
              ? 'התשלום בוצע בהצלחה והאירוע נוצר!'
              : 'ההזמנה נשלחה בהצלחה!'}
          </h2>
          <p className="wiz-success__text">
            {state.contactPreference === 'pay-now' && !paymentSkipped
              ? 'האירוע שלכם נוצר במערכת! שלחנו לכם מייל עם חשבונית/קבלה והסבר מפורט על השלבים הבאים. לכל שאלה אנחנו כאן בשבילכם.'
              : state.contactPreference === 'pay-now' && paymentSkipped
                ? 'לא הצלחנו לפתוח את דף התשלום. ניצור איתכם קשר להשלמת ההזמנה.'
                : 'קיבלנו את כל הפרטים ונחזור אליכם בהקדם. נפנה אליכם תוך 48 שעות.'}
          </p>
          <p className="wiz-success__contact">
            לכל שאלה או בקשה -{' '}
            <a href="mailto:contact@eventa.productions" className="wiz-success__link">contact@eventa.productions</a>
          </p>
          <Link href="/" className="wiz-success__btn">
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
          <Link href="/" className="wiz-back" aria-label="חזרה לדף הראשי">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M13 4l6 6-6 6" />
            </svg>
          </Link>
        )}
        <Link href="/" className="wiz-header__logo">
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
        {step === 4 && <StepMessages state={state} onChange={onChange} />}
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
            {sending ? 'שולח...' : state.contactPreference === 'pay-now' ? 'מעבר לתשלום' : 'שלחו הזמנה'}
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
            {step === 4
              ? (state.wantsGuestMessages
                  ? 'ממשיכים עם שליחת הודעות לאורחים'
                  : 'ממשיכים בלי שליחת הודעות')
              : 'הבא'}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M7 4l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
