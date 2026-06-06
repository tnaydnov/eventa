'use client';

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore } from '@/lib/store';
import { sendOtp, verifyOtp } from '@/lib/api';
import { getDeviceIdentifiers } from '@/lib/device-fingerprint';
import { OTP_RESEND_COOLDOWN_S } from '@/lib/config';
import MobileGuard from '@/components/MobileGuard';
import LegalDrawer from '@/components/LegalDrawer';
import PhoneInput from '@/components/PhoneInput';
import OtpInput from '@/components/OtpInput';
import OnboardingSlides from '@/components/OnboardingSlides';
import PremiumSplashScreen from '@/components/join/PremiumSplashScreen';
import PremiumJoinShell from '@/components/join/PremiumJoinShell';
import {
  SESSION_STORAGE_KEY,
  PROFILE_SETUP_KEY_PREFIX,
  ONBOARDING_SEEN_KEY_PREFIX,
} from '@/lib/constants';

/** Detect in-app browsers / QR scanner WebViews that don't persist cookies */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // Social-media & messaging in-app browsers
  if (/FBAN|FBAV|Instagram|Snapchat|Line\/|Twitter|MicroMessenger|QQBrowser|BytedanceWebview|musical_ly|TikTok/i.test(ua)) return true;

  // iOS WebView - real Safari always includes "Safari/" in UA
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//i.test(ua)) return true;

  // Android WebView - the "; wv)" token is the official flag
  if (/Android/.test(ua) && /;\s*wv[);]/i.test(ua)) return true;

  // Samsung Internet's in-app mode / Samsung Browser custom tabs
  if (/SamsungBrowser\/.*CrossApp/i.test(ua)) return true;

  // Generic "standalone" detection - not maximally reliable but catches
  // many QR-scanner apps that open Chrome Custom Tabs without full browser UI
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__gCrWeb) return true; // iOS WKWebView injected object

  return false;
}

/** Min local digits for a valid Israeli mobile number (e.g. "501234567") */
const VALID_LOCAL_DIGITS = 9;

/** Minimum time the splash stays visible on a fresh boot before showing UI. */
const MIN_SPLASH_MS = 1200;

/** Minimum time the splash stays visible when redirecting a returning user. */
const RETURNING_USER_MIN_SPLASH_MS = 800;

type JoinStep = 'welcome' | 'phone' | 'otp' | 'onboarding';
type Phase =
  | 'booting'
  | 'returning_user'
  | 'event_not_found'
  | 'event_inactive'
  | 'event_ended'
  | 'access_blocked'
  | 'fatal_error'
  | 'verifying_otp'
  | 'completing_join'
  | 'interactive';

interface ConsentRowProps {
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

/**
 * Premium consent row using a real native <input type="checkbox"> wrapped in a
 * <label>. Keeps full keyboard / screen-reader / autofill semantics.
 */
function ConsentRow({ checked, onToggle, ariaLabel, children }: ConsentRowProps) {
  return (
    <label className="pj-consent" data-checked={checked ? 'true' : 'false'}>
      <input
        type="checkbox"
        className="pj-consent-input"
        checked={checked}
        onChange={onToggle}
        aria-label={ariaLabel}
      />
      <span className="pj-consent-box" aria-hidden="true">
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" focusable="false">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="pj-consent-text">{children}</span>
    </label>
  );
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return (
    <Suspense fallback={<PremiumSplashScreen subtitle="טוענים את חוויית האירוע..." />}>
      <JoinPageContent params={params} />
    </Suspense>
  );
}

function JoinPageContent({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setParticipant = useSessionStore((s) => s.setParticipant);

  // ─── Phase machine + step ─────────────────────────────────
  const [phase, setPhase] = useState<Phase>('booting');
  const [step, setStep] = useState<JoinStep>('welcome');
  const [agreed, setAgreed] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'cookies' | null>(null);
  const [error, setError] = useState('');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ─── Phone verification state ─────────────────────────────
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(true);
  const [otpValue, setOtpValue] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Onboarding navigation target ─────────────────────────
  const pendingNav = useRef<string | null>(null);

  // ─── Boot: combined session check + event status ──────────
  useEffect(() => {
    let cancelled = false;
    let returningTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    async function boot() {
      const bootStart = Date.now();

      /** Defer a phase change until the minimum splash time has elapsed. */
      const settle = (fn: () => void) => {
        const remaining = MIN_SPLASH_MS - (Date.now() - bootStart);
        if (remaining <= 0) {
          if (!cancelled) fn();
          return;
        }
        settleTimer = setTimeout(() => {
          if (!cancelled) fn();
        }, remaining);
      };

      // 1) Returning-user fast path
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session && session.eventSlug === eventSlug) {
            setSession(session);
            const dest = localStorage.getItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`)
              ? `/${eventSlug}`
              : `/${eventSlug}/setup`;
            if (cancelled) return;
            setPhase('returning_user');
            returningTimer = setTimeout(() => {
              if (!cancelled) router.replace(dest);
            }, RETURNING_USER_MIN_SPLASH_MS);
            return;
          }
        } catch {
          // fall through to fresh boot
        }
      }

      // 2) Validate event status before showing the welcome card
      try {
        const joinCode = searchParams.get('k');
        const qrParam = joinCode ? '&from_qr=1' : '';
        const res = await fetch(`/api/auth/event-status?slug=${encodeURIComponent(eventSlug)}${qrParam}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'not_found') {
          settle(() => setPhase('event_not_found'));
          return;
        }

        if (data.status === 'ended' || data.status === 'archived') {
          settle(() => setPhase('event_ended'));
          return;
        }

        if (
          data.status &&
          data.status !== 'active' &&
          data.status !== 'draft' &&
          data.status !== 'error'
        ) {
          // Unknown non-active state - treat as inactive
          settle(() => setPhase('event_inactive'));
          return;
        }
      } catch {
        // Network failure - allow user to proceed; later API calls will catch real issues
      }

      settle(() => {
        setPhase('interactive');
        setStep('welcome');
      });
    }

    boot();
    return () => {
      cancelled = true;
      if (returningTimer) clearTimeout(returningTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [eventSlug, router, setSession]);

  // Detect in-app browser on mount
  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // ─── Helpers ──────────────────────────────────────────────

  const getJoinCode = useCallback((): string => {
    return searchParams.get('k') ?? '';
  }, [searchParams]);

  const completeJoin = useCallback(
    (result: {
      eventId: string;
      eventName: string;
      backgroundImage: string | null;
      participantId: string;
      participant: { display_name?: string | null } | null;
    }) => {
      const session = {
        eventId: result.eventId,
        eventSlug,
        eventName: result.eventName,
        backgroundImage: result.backgroundImage ?? null,
        participantId: result.participantId,
      };
      setSession(session);

      if (result.participant && result.participant.display_name) {
        // Returning user - skip onboarding
        setParticipant(result.participant as Parameters<typeof setParticipant>[0]);
        localStorage.setItem(`${PROFILE_SETUP_KEY_PREFIX}${result.participantId}`, 'true');
        setPhase('completing_join');
        router.replace(`/${eventSlug}`);
      } else {
        // New user - onboarding gate, then setup
        const onboardingKey = `${ONBOARDING_SEEN_KEY_PREFIX}${result.participantId}`;
        if (localStorage.getItem(onboardingKey)) {
          setPhase('completing_join');
          router.replace(`/${eventSlug}/setup`);
        } else {
          pendingNav.current = `/${eventSlug}/setup`;
          setStep('onboarding');
          setPhase('interactive');
        }
      }
    },
    [eventSlug, router, setSession, setParticipant],
  );

  const handleOnboardingComplete = useCallback(() => {
    const session = useSessionStore.getState().session;
    if (session?.participantId) {
      localStorage.setItem(`${ONBOARDING_SEEN_KEY_PREFIX}${session.participantId}`, 'true');
    }
    const nav = pendingNav.current || `/${eventSlug}/setup`;
    setPhase('completing_join');
    router.replace(nav);
  }, [eventSlug, router]);

  const startResendTimer = useCallback(() => {
    setResendTimer(OTP_RESEND_COOLDOWN_S);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────

  /** Welcome → Phone (phone verification is always required). */
  const handleTermsAccepted = useCallback(() => {
    if (!agreed) return;
    setError('');
    setStep('phone');
  }, [agreed]);

  const handleSendOtp = useCallback(async () => {
    const joinCode = getJoinCode() || undefined;
    if (phone.length !== VALID_LOCAL_DIGITS) {
      setError('הזינו מספר סלולרי ישראלי תקין');
      return;
    }

    setPhase('verifying_otp');
    setError('');

    const fullPhone = `0${phone}`;
    const result = await sendOtp({ phone: fullPhone, eventSlug, joinCode });

    if (!result.success) {
      setError(result.error || 'שגיאה בשליחת הקוד - נסו שוב');
      setPhase('interactive');
      return;
    }

    setMaskedPhone(result.maskedPhone || '');
    setOtpValue('');
    setStep('otp');
    startResendTimer();
    setPhase('interactive');
  }, [phone, eventSlug, getJoinCode, startResendTimer]);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      const joinCode = getJoinCode() || undefined;

      setPhase('verifying_otp');
      setError('');

      try {
        const { localId, hardwareFingerprint } = await getDeviceIdentifiers();
        const fullPhone = `0${phone}`;
        const result = await verifyOtp({
          phone: fullPhone,
          code,
          eventSlug,
          joinCode,
          fingerprint: localId,
          hardwareFingerprint,
          smsConsent,
          smsNotificationsEnabled,
        });
        completeJoin(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'DEVICE_BANNED') {
          setPhase('access_blocked');
          return;
        }
        setError(err instanceof Error ? err.message : 'אימות הקוד נכשל - נסו שוב');
        setPhase('interactive');
      }
    },
    [phone, eventSlug, smsConsent, smsNotificationsEnabled, getJoinCode, completeJoin],
  );

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;
    setOtpValue('');
    setError('');
    await handleSendOtp();
  }, [resendTimer, handleSendOtp]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────

  // Compute which full-screen view to show
  const splashSubtitle: string | null =
    phase === 'booting'         ? 'טוענים את חוויית האירוע...' :
    phase === 'returning_user'  ? 'מחזירים אותך לאירוע...' :
    phase === 'completing_join' ? 'כבר נכנסים לאירוע...' :
    phase === 'verifying_otp'   ? (step === 'otp' ? 'מאמתים את הקוד...' : 'שולחים קוד אימות...') :
    null;

  const isErrorPhase = (
    phase === 'event_not_found' ||
    phase === 'event_inactive'  ||
    phase === 'event_ended'     ||
    phase === 'access_blocked'  ||
    phase === 'fatal_error'
  );

  const errorMessages = {
    event_not_found: { title: 'האירוע לא נמצא',         body: <>הקישור שקיבלתם לא מוביל לאירוע פעיל.<br />ודאו שהקישור תקין או פנו למארגן האירוע.</> },
    event_inactive:  { title: 'האירוע עדיין לא פעיל',   body: <>האירוע הזה טרם התחיל.<br />נסו שוב סמוך למועד האירוע.</> },
    event_ended:     { title: 'האירוע הסתיים',           body: <>תקופת ההיכרויות באירוע הזה הסתיימה.<br />תודה שהשתתפתם!</> },
    access_blocked:  { title: 'הגישה נחסמה',             body: <>המכשיר הזה אינו יכול להיכנס לאירוע.<br />אם נראה לכם שזו טעות, פנו למארגן האירוע.</> },
    fatal_error:     { title: 'משהו השתבש',              body: <>לא הצלחנו לטעון את האירוע כרגע.<br />נסו לרענן את הדף בעוד רגע.</> },
  } as const;

  const errorMsg = isErrorPhase
    ? errorMessages[phase as keyof typeof errorMessages]
    : null;

  const isOnboarding  = phase === 'interactive' && step === 'onboarding';
  const isInteractive = phase === 'interactive' && step !== 'onboarding';

  const pageVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.38, ease: 'easeOut' } },
    exit:    { opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } },
  };
  // ─── iabNotice (needed inside the interactive shell) ─

  const iabNotice = inAppBrowser ? (
    <div className="pj-iab" role="note">
      <div className="pj-iab-row">
        <div className="pj-iab-icon" aria-hidden="true">!</div>
        <div className="pj-iab-text">
          {linkCopied
            ? 'הקישור הועתק - פתחו Safari או Chrome והדביקו אותו שם.'
            : 'נראה שפתחתם את Eventa מתוך אפליקציה חיצונית. לחוויה חלקה, פתחו את הקישור ב-Safari או Chrome.'}
        </div>
      </div>
      <button type="button" className="pj-iab-btn" onClick={handleCopyLink}>
        <span role="status" aria-live="polite">
          {linkCopied ? 'הקישור הועתק' : 'העתקת הקישור'}
        </span>
      </button>
    </div>
  ) : null;

  return (
    <MobileGuard>
      <div className="pj-page-root">
        <AnimatePresence mode="sync" initial={false}>

          {splashSubtitle !== null && (
            <motion.div key="splash" className="pj-page-layer" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <PremiumSplashScreen subtitle={splashSubtitle} />
            </motion.div>
          )}

          {isErrorPhase && errorMsg && (
            <motion.div key="error" className="pj-page-layer" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="pj-bg" dir="rtl">
                <div className="pj-shell-stage">
                  <div className="pj-shell-header">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/Eventa_Logo.png" alt="Eventa" className="pj-shell-logo" draggable={false} decoding="async" />
                  </div>
                  <div className="pj-card" role="alert">
                    <h1 className="pj-title">{errorMsg.title}</h1>
                    <p className="pj-subtitle">{errorMsg.body}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {isOnboarding && (
            <motion.div key="onboarding" className="pj-page-layer" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <OnboardingSlides onComplete={handleOnboardingComplete} />
            </motion.div>
          )}

          {isInteractive && (
            <motion.div key="interactive" className="pj-page-layer" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <PremiumJoinShell stepKey={step} notice={iabNotice}>
        {step === 'welcome' && (
          <>
            <h1 className="pj-title">ברוכים הבאים ל-Eventa</h1>
            <p className="pj-subtitle">
             הרווקים והרווקות של האירוע כבר כאן. עכשיו נשאר רק לגלות מי יכול/ה להתאים לך.
            </p>

            <div className="pj-vibes" aria-hidden="false">
              <div className="pj-vibe">
                <span className="pj-vibe-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                מגלים מי פה
              </div>
              <div className="pj-vibe">
                <span className="pj-vibe-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </span>
                שולחים לייק
              </div>
              <div className="pj-vibe">
                <span className="pj-vibe-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </span>
                מתחילים שיחה
              </div>
            </div>

            <p className="pj-blurb">
              Eventa פתוחה רק למשתתפי האירוע הזה. הכניסה דרך אימות קצר במספר טלפון - בלי הורדות, בלי הרשמות.
            </p>

            <ConsentRow
              checked={agreed}
              onToggle={() => setAgreed(!agreed)}
              ariaLabel="אני מאשר/ת את תנאי השימוש, מדיניות הפרטיות ומדיניות העוגיות"
            >
              אני מאשר/ת את{' '}
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('terms'); }}>תנאי השימוש</button>
              ,{' '}
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('privacy'); }}>מדיניות הפרטיות</button>
              {' '}ו
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('cookies'); }}>מדיניות העוגיות</button>
              , ומבין/ה שבאירועים מסוימים Eventa עשויה לצלם תכני אווירה לצורכי שיווק, כמפורט בתנאי השימוש.
            </ConsentRow>

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              className="pj-cta"
              type="button"
              disabled={!agreed}
              onClick={handleTermsAccepted}
            >
              המשך
            </button>

            <p className="pj-microcopy">הכול נמחק אוטומטית אחרי האירוע.</p>
          </>
        )}

        {step === 'phone' && (
          <>
            <h1 className="pj-title">רגע קטן ונכנסים</h1>
            <p className="pj-subtitle">
              נשלח קוד חד-פעמי לטלפון שלך כדי לוודא שאתה באירוע.
            </p>

            <PhoneInput
              value={phone}
              onChange={(v) => { setPhone(v); setError(''); }}
              disabled={false}
              error={undefined}
            />

            <ConsentRow
              checked={smsConsent}
              onToggle={() => setSmsConsent(!smsConsent)}
              ariaLabel="אני מאשר/ת קבלת קוד אימות ב-SMS"
            >
              אני מאשר/ת קבלת קוד אימות ב-SMS לצורך כניסה לשירות.
            </ConsentRow>

            <ConsentRow
              checked={smsNotificationsEnabled}
              onToggle={() => setSmsNotificationsEnabled(!smsNotificationsEnabled)}
              ariaLabel="קבל/י SMS כשיש לייק, הודעה או התאמה חדשה"
            >
              <span>שלחו לי SMS כשיש לייק, הודעה או התאמה חדשה</span>
              <span style={{ display: 'block', fontSize: '0.75em', opacity: 0.6, marginTop: 2 }}>הדפדפן לא תומך בהתראות - זו הדרך לא לפספס</span>
            </ConsentRow>

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              className="pj-cta"
              type="button"
              disabled={phone.length !== VALID_LOCAL_DIGITS}
              onClick={handleSendOtp}
            >
              שלחו לי קוד
            </button>

            <button
              type="button"
              className="pj-link"
              onClick={() => { setStep('welcome'); setError(''); }}
            >
              חזרה
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="pj-title">הקוד אצלך?</h1>
            <p className="pj-subtitle">
              {maskedPhone ? (
                <>הזינו את 6 הספרות ששלחנו ל-<span dir="ltr" style={{ unicodeBidi: 'embed' }}>{maskedPhone}</span></>
              ) : (
                'הזינו את 6 הספרות ששלחנו אליכם ב-SMS'
              )}
            </p>

            <OtpInput
              value={otpValue}
              onChange={setOtpValue}
              onComplete={handleVerifyOtp}
              disabled={false}
              error={error || undefined}
            />

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              type="button"
              className={`pj-link${resendTimer > 0 ? '' : ' is-primary'}`}
              disabled={resendTimer > 0}
              onClick={handleResendOtp}
            >
              {resendTimer > 0
                ? `אפשר לשלוח שוב בעוד ${resendTimer} שניות`
                : 'שלחו קוד חדש'}
            </button>

            <button
              type="button"
              className="pj-link"
              onClick={() => { setStep('phone'); setError(''); setOtpValue(''); }}
            >
              חזרה לעריכת מספר
            </button>
          </>
        )}
              </PremiumJoinShell>
            </motion.div>
          )}

        </AnimatePresence>

        <LegalDrawer page={legalPage} onClose={() => setLegalPage(null)} />
      </div>
    </MobileGuard>
  );
}
