'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '@/lib/store';
import { joinEvent, sendOtp, verifyOtp } from '@/lib/api';
import { getDeviceIdentifiers } from '@/lib/device-fingerprint';
import { OTP_RESEND_COOLDOWN_S } from '@/lib/config';
import { PHONE_VERIFICATION_ENABLED } from '@/lib/config';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import LegalDrawer from '@/components/LegalDrawer';
import PhoneInput from '@/components/PhoneInput';
import OtpInput from '@/components/OtpInput';

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

/** Step transition animation variants */
const stepVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.15, ease: 'easeIn' as const } },
};

type JoinStep = 'terms' | 'phone' | 'otp';

export default function JoinPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setParticipant = useSessionStore((s) => s.setParticipant);

  // ─── Shared state ─────────────────────────────────────────
  const [step, setStep] = useState<JoinStep>('terms');
  const [agreed, setAgreed] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'cookies' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  // ─── Phone verification state ─────────────────────────────
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [otpValue, setOtpValue] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Lifecycle effects ────────────────────────────────────

  // Check event status BEFORE showing terms - redirect if not active
  useEffect(() => {
    async function checkEventStatus() {
      try {
        const res = await fetch(`/api/auth/event-status?slug=${encodeURIComponent(eventSlug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== 'active' && data.status !== 'draft') {
            const reason = data.status === 'ended' || data.status === 'archived' ? data.status : 'ended';
            router.replace(`/dating/event-over?reason=${reason}`);
            return;
          }
          if (data.status === 'not_found') {
            setError('האירוע לא נמצא - ודאו שהקישור תקין');
          }
        }
      } catch {
        // If status check fails, let them proceed normally
      }
      setStatusChecked(true);
    }
    checkEventStatus();
  }, [eventSlug, router]);

  // Detect in-app browser on mount
  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  // Check for existing session
  useEffect(() => {
    const stored = localStorage.getItem('eventa_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.eventSlug === eventSlug) {
          setSession(session);
          const hasProfile = localStorage.getItem(`profile_setup_${session.participantId}`);
          if (hasProfile) {
            router.replace(`/dating/${eventSlug}`);
          } else {
            router.replace(`/dating/${eventSlug}/setup`);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [eventSlug, router, setSession]);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // ─── Helpers ──────────────────────────────────────────────

  /** Get join code from URL or set error */
  const getJoinCode = useCallback((): string | null => {
    const code = searchParams.get('k');
    if (!code) {
      setError('קוד כניסה חסר - סרקו שוב את ה-QR');
      return null;
    }
    return code;
  }, [searchParams]);

  /** Navigate to the correct page after successful join */
  const completeJoin = useCallback(
    (result: { eventId: string; eventName: string; backgroundImage: string | null; participantId: string; participant: { display_name?: string | null } | null }) => {
      const session = {
        eventId: result.eventId,
        eventSlug,
        eventName: result.eventName,
        backgroundImage: result.backgroundImage ?? null,
        participantId: result.participantId,
      };
      setSession(session);

      if (result.participant && result.participant.display_name) {
        setParticipant(result.participant as Parameters<typeof setParticipant>[0]);
        localStorage.setItem(`profile_setup_${result.participantId}`, 'true');
        router.replace(`/dating/${eventSlug}`);
      } else {
        router.replace(`/dating/${eventSlug}/setup`);
      }
    },
    [eventSlug, router, setSession, setParticipant],
  );

  /** Start the resend cooldown timer */
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

  /** Step 1 → Step 2 (or direct join if phone verification disabled) */
  const handleTermsAccepted = useCallback(async () => {
    const joinCode = getJoinCode();
    if (!joinCode) return;

    if (!PHONE_VERIFICATION_ENABLED) {
      // Bypass phone verification - use fingerprint join
      setLoading(true);
      setError('');
      try {
        const { localId, hardwareFingerprint } = await getDeviceIdentifiers();
        const result = await joinEvent(eventSlug, joinCode, localId, hardwareFingerprint);
        if (!result) {
          setError('קוד כניסה לא תקין או שהאירוע לא פעיל');
          setLoading(false);
          return;
        }
        completeJoin(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'DEVICE_BANNED') {
          setError('המכשיר הזה חסום מלהיכנס לאירוע זה');
        } else {
          setError('שגיאה בהתחברות - נסו שוב');
        }
      }
      setLoading(false);
      return;
    }

    // Phone verification enabled – go to phone step
    setError('');
    setStep('phone');
  }, [getJoinCode, eventSlug, completeJoin]);

  /** Step 2: Send OTP → move to Step 3 */
  const handleSendOtp = useCallback(async () => {
    const joinCode = getJoinCode();
    if (!joinCode) return;
    if (phone.length !== VALID_LOCAL_DIGITS) {
      setError('הזינו מספר סלולרי ישראלי תקין');
      return;
    }

    setLoading(true);
    setError('');

    // Prepend "0" to local digits for normalisation (e.g. "501234567" → "0501234567")
    const fullPhone = `0${phone}`;
    const result = await sendOtp({ phone: fullPhone, eventSlug, joinCode });

    if (!result.success) {
      setError(result.error || 'שגיאה בשליחת הקוד - נסו שוב');
      setLoading(false);
      return;
    }

    setMaskedPhone(result.maskedPhone || '');
    setOtpValue('');
    setStep('otp');
    startResendTimer();
    setLoading(false);
  }, [phone, eventSlug, getJoinCode, startResendTimer]);

  /** Step 3: Verify OTP */
  const handleVerifyOtp = useCallback(
    async (code: string) => {
      const joinCode = getJoinCode();
      if (!joinCode) return;

      setLoading(true);
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
        });
        completeJoin(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'DEVICE_BANNED') {
          setError('המכשיר הזה חסום מלהיכנס לאירוע זה');
        } else {
          setError(err instanceof Error ? err.message : 'אימות הקוד נכשל - נסו שוב');
        }
      }
      setLoading(false);
    },
    [phone, eventSlug, smsConsent, getJoinCode, completeJoin],
  );

  /** Resend OTP (same as handleSendOtp but resets timer) */
  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;
    setOtpValue('');
    setError('');
    await handleSendOtp();
  }, [resendTimer, handleSendOtp]);

  // ─── Render ───────────────────────────────────────────────

  /** Shared checkbox component */
  const Checkbox = ({ checked, onChange: onToggle, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) => (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); } }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 320,
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `2px solid ${checked ? 'var(--primary)' : 'var(--card-border)'}`,
          background: checked ? 'var(--primary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
        }}
        aria-hidden="true"
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden="true" focusable="false">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 14, textAlign: 'start' }}>{children}</span>
    </div>
  );

  return (
    <MobileGuard>
      <PageTransition>
        {!statusChecked ? (
          <div
            className="app-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100dvh',
            }}
          >
            <img src="/icons/Eventa_Logo.png" alt="Eventa" width={100} height={100} style={{ objectFit: 'contain', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : (
          <div
            className="app-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100dvh',
              padding: 32,
              textAlign: 'center',
              gap: 24,
            }}
          >
            <img src="/icons/Eventa_Logo.png" alt="Eventa" width={140} height={140} style={{ objectFit: 'contain' }} />

            {inAppBrowser && (
              <div
                style={{
                  background: 'rgba(255, 180, 50, 0.12)',
                  border: '1px solid rgba(255, 180, 50, 0.3)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  maxWidth: 320,
                  width: '100%',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#ffb432',
                }}
              >
                <strong>⚠️ שימו לב</strong>
                <br />
                אתם גולשים מתוך אפליקציה חיצונית. כדי שהחיבור שלכם יישמר,
                פתחו את הקישור ב-
                <strong>Safari</strong> או <strong>Chrome</strong>.
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      const btn = document.getElementById('copy-link-btn');
                      if (btn) btn.textContent = '✅ הקישור הועתק!';
                    } catch {
                      const input = document.createElement('input');
                      input.value = window.location.href;
                      document.body.appendChild(input);
                      input.select();
                      document.execCommand('copy');
                      document.body.removeChild(input);
                      const btn = document.getElementById('copy-link-btn');
                      if (btn) btn.textContent = '✅ הקישור הועתק!';
                    }
                  }}
                  id="copy-link-btn"
                  style={{
                    display: 'block',
                    margin: '10px auto 0',
                    padding: '8px 20px',
                    background: 'rgba(255, 180, 50, 0.2)',
                    border: '1px solid rgba(255, 180, 50, 0.4)',
                    borderRadius: 8,
                    color: '#ffb432',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  📋 העתק קישור
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* ─── Step 1: Terms ─── */}
              {step === 'terms' && (
                <motion.div
                  key="terms"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%' }}
                >
                  <h1 style={{ fontSize: 28, color: 'var(--primary)', margin: 0 }}>
                    ברוכים הבאים!
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6 }}>
                    האפליקציה מאפשרת לכם ליצור קשר עם רווקים ורווקות באירוע.
                    <br />
                    כל המידע נמחק אוטומטית לאחר 7 ימים.
                  </p>

                  <Checkbox checked={agreed} onChange={() => setAgreed(!agreed)}>
                    אני מסכים/ה ל<button type="button" style={{ color: 'var(--primary)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setLegalPage('terms'); }}>תנאי השימוש</button>, <button type="button" style={{ color: 'var(--primary)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setLegalPage('privacy'); }}>מדיניות הפרטיות</button> ו<button type="button" style={{ color: 'var(--primary)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setLegalPage('cookies'); }}>מדיניות העוגיות</button>
                  </Checkbox>

                  {error && (
                    <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ maxWidth: 320 }}
                    disabled={!agreed || loading}
                    onClick={handleTermsAccepted}
                  >
                    {loading ? 'מתחבר...' : 'המשך'}
                  </button>
                </motion.div>
              )}

              {/* ─── Step 2: Phone ─── */}
              {step === 'phone' && (
                <motion.div
                  key="phone"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}
                >
                  <h1 style={{ fontSize: 24, color: 'var(--primary)', margin: 0 }}>
                    הזינו מספר טלפון
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    נשלח קוד אימות ב-SMS לנייד שלכם
                  </p>

                  <PhoneInput
                    value={phone}
                    onChange={(v) => { setPhone(v); setError(''); }}
                    disabled={loading}
                    error={undefined}
                  />

                  <Checkbox checked={smsConsent} onChange={() => setSmsConsent(!smsConsent)}>
                    אני מסכים/ה לקבל הודעות SMS ו-WhatsApp
                  </Checkbox>

                  {error && (
                    <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ maxWidth: 320 }}
                    disabled={phone.length !== VALID_LOCAL_DIGITS || loading}
                    onClick={handleSendOtp}
                  >
                    {loading ? 'שולח קוד...' : 'שלחו קוד'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep('terms'); setError(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontFamily: 'inherit',
                    }}
                  >
                    חזרה
                  </button>
                </motion.div>
              )}

              {/* ─── Step 3: OTP ─── */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}
                >
                  <h1 style={{ fontSize: 24, color: 'var(--primary)', margin: 0 }}>
                    הזינו את הקוד
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    {maskedPhone
                      ? <>שלחנו קוד ל-<span dir="ltr" style={{ unicodeBidi: 'embed' }}>{maskedPhone}</span></>
                      : 'שלחנו קוד SMS לנייד שלכם'}
                  </p>

                  <OtpInput
                    value={otpValue}
                    onChange={setOtpValue}
                    onComplete={handleVerifyOtp}
                    disabled={loading}
                    error={error || undefined}
                  />

                  {error && (
                    <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      disabled={resendTimer > 0 || loading}
                      onClick={handleResendOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--primary)',
                        fontSize: 14,
                        cursor: resendTimer > 0 ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        textDecoration: resendTimer > 0 ? 'none' : 'underline',
                      }}
                    >
                      {resendTimer > 0
                        ? `שלחו שוב (${resendTimer}s)`
                        : 'שלחו שוב'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStep('phone'); setError(''); setOtpValue(''); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontFamily: 'inherit',
                      }}
                    >
                      שנו מספר טלפון
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </PageTransition>

      <LegalDrawer page={legalPage} onClose={() => setLegalPage(null)} />
    </MobileGuard>
  );
}
