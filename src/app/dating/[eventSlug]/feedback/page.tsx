'use client';

import { use, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

/* ─── Types ─── */
type UsageLevel = 'view_only' | 'likes' | 'matches' | 'chat';
type InteractionResult = 'messages' | 'real_life' | 'interesting' | 'none';
type SuccessStoryAnswer = 'yes' | 'maybe' | 'no';
type FeatureKey = 'swipes' | 'chat' | 'see_likes' | 'design' | 'concept' | 'vibe' | 'nothing';

interface EventStats {
  participants: number;
  matches: number;
  messages: number;
}

/* ─── Motion ─── */
const TOTAL_STEPS = 11;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60, transition: { duration: 0.25, ease: EASE } }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

/* ─── Counter ─── */
function Counter({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.8, ease: 'easeOut' });
    return () => ctrl.stop();
  }, [mv, value]);
  return <motion.span>{display}</motion.span>;
}

/* ─── Progress ─── */
function Progress({ current, total }: { current: number; total: number }) {
  const questionSteps = total - 2;
  const pct = (current - 1) / questionSteps;
  if (current === 0 || current >= total - 1) return null;
  return (
    <div className="fb-progress" role="progressbar" aria-valuenow={current} aria-valuemax={questionSteps}>
      <div className="fb-progress__track">
        <motion.div
          className="fb-progress__fill"
          initial={false}
          animate={{ scaleX: Math.max(0, pct) }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>
      <span className="fb-progress__text">{current} / {questionSteps}</span>
    </div>
  );
}

/* ─── Option Card ─── */
function OptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      className={`fb-card${selected ? ' fb-card--active' : ''}`}
      onClick={onClick}
      variants={fadeUp}
      whileTap={{ scale: 0.97 }}
      type="button"
      aria-pressed={selected}
    >
      <span className="fb-card__label">{label}</span>
      {selected && (
        <motion.div
          className="fb-card__bar"
          layoutId="card-bar"
          transition={{ type: 'spring' as const, stiffness: 500, damping: 35 }}
        />
      )}
    </motion.button>
  );
}

/* ─── Tag (multi-select) ─── */
function Tag({ label, selected, onClick, muted }: { label: string; selected: boolean; onClick: () => void; muted?: boolean }) {
  return (
    <motion.button
      className={`fb-tag${selected ? ' fb-tag--active' : ''}${muted ? ' fb-tag--muted' : ''}`}
      onClick={onClick}
      variants={fadeUp}
      whileTap={{ scale: 0.96 }}
      type="button"
      aria-pressed={selected}
    >
      {label}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════ */
export default function FeedbackPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = use(params);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState('');

  const [enjoyment, setEnjoyment] = useState(0);
  const [easeOfUse, setEaseOfUse] = useState(0);
  const [usageLevel, setUsageLevel] = useState<UsageLevel | ''>('');
  const [interactionResult, setInteractionResult] = useState<InteractionResult | ''>('');
  const [favoriteFeatures, setFavoriteFeatures] = useState<FeatureKey[]>([]);
  const [improvement, setImprovement] = useState('');
  const [recommendation, setRecommendation] = useState(0);
  const [successStory, setSuccessStory] = useState<SuccessStoryAnswer | ''>('');
  const [successStoryText, setSuccessStoryText] = useState('');
  const [allowPublish, setAllowPublish] = useState(false);

  const formRef = useRef({
    enjoyment: 0, easeOfUse: 0, usageLevel: 'view_only' as UsageLevel,
    interactionResult: 'none' as InteractionResult, favoriteFeatures: [] as FeatureKey[],
    improvement: '', recommendation: 0, successStory: null as SuccessStoryAnswer | null,
    successStoryText: '', allowStoryPublish: false,
  });

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    if (step <= 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  }, [step]);

  const pick = useCallback((fn: () => void) => {
    fn();
    setTimeout(() => { setDirection(1); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }, 300);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventSlug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enjoyment, easeOfUse,
          usageLevel: usageLevel || 'view_only',
          interactionResult: interactionResult || 'none',
          favoriteFeatures,
          improvement: improvement || null,
          recommendation,
          successStory: successStory || null,
          successStoryText: successStoryText || null,
          allowStoryPublish: allowPublish,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'שגיאה' }));
        setError(msg || 'שגיאה בשליחה');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      try {
        const sr = await fetch(`/api/events/${eventSlug}/stats`);
        if (sr.ok) setStats(await sr.json());
      } catch { /* optional */ }
      setDirection(1);
      setStep(TOTAL_STEPS - 1);
    } catch {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, enjoyment, easeOfUse, usageLevel, interactionResult, favoriteFeatures, improvement, recommendation, successStory, successStoryText, allowPublish, eventSlug]);

  /* ─── Steps ─── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="fb-intro">
            <motion.span className="fb-kicker" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              משוב אנונימי
            </motion.span>
            <motion.h1 className="fb-headline" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease: EASE }}>
              ספרו לנו<br /><span className="fb-headline__em">איך היה.</span>
            </motion.h1>
            <motion.p className="fb-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
              שאלון קצר ואנונימי.<br />בסוף תגלו סטטיסטיקות מהאירוע.
            </motion.p>
            <motion.button className="fb-cta" onClick={goNext} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} whileTap={{ scale: 0.97 }}>
              התחלה
            </motion.button>
          </div>
        );

      case 1:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">כמה נהנית מהחוויה?</h2>
            <motion.div className="fb-q__grid" variants={stagger} initial="hidden" animate="show">
              {[{ l: 'לא ממש', v: 1 }, { l: 'היה סבבה', v: 2 }, { l: 'נהניתי', v: 3 }, { l: 'אהבתי', v: 4 }].map((o) => (
                <OptionCard key={o.v} label={o.l} selected={enjoyment === o.v} onClick={() => pick(() => { setEnjoyment(o.v); formRef.current.enjoyment = o.v; })} />
              ))}
            </motion.div>
          </div>
        );

      case 2:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">כמה היה קל להשתמש?</h2>
            <motion.div className="fb-q__grid" variants={stagger} initial="hidden" animate="show">
              {[{ l: 'מבלבל', v: 1 }, { l: 'הסתדרתי', v: 2 }, { l: 'ברור', v: 3 }, { l: 'פשוט מאוד', v: 4 }].map((o) => (
                <OptionCard key={o.v} label={o.l} selected={easeOfUse === o.v} onClick={() => pick(() => { setEaseOfUse(o.v); formRef.current.easeOfUse = o.v; })} />
              ))}
            </motion.div>
          </div>
        );

      case 3:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">כמה השתמשת באפליקציה?</h2>
            <motion.div className="fb-q__grid" variants={stagger} initial="hidden" animate="show">
              {([
                { l: 'רק הסתכלתי', v: 'view_only' as UsageLevel },
                { l: 'שלחתי לייקים', v: 'likes' as UsageLevel },
                { l: 'היו לי התאמות', v: 'matches' as UsageLevel },
                { l: 'גם דיברתי בצ׳אט', v: 'chat' as UsageLevel },
              ]).map((o) => (
                <OptionCard key={o.v} label={o.l} selected={usageLevel === o.v} onClick={() => pick(() => { setUsageLevel(o.v); formRef.current.usageLevel = o.v; })} />
              ))}
            </motion.div>
          </div>
        );

      case 4:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">יצרת קשר עם מישהו?</h2>
            <motion.div className="fb-q__grid" variants={stagger} initial="hidden" animate="show">
              {([
                { l: 'החלפנו הודעות', v: 'messages' as InteractionResult },
                { l: 'דיברנו במציאות', v: 'real_life' as InteractionResult },
                { l: 'מצאתי מישהו מעניין', v: 'interesting' as InteractionResult },
                { l: 'לא, אבל היה כיף', v: 'none' as InteractionResult },
              ]).map((o) => (
                <OptionCard key={o.v} label={o.l} selected={interactionResult === o.v} onClick={() => pick(() => { setInteractionResult(o.v); formRef.current.interactionResult = o.v; })} />
              ))}
            </motion.div>
          </div>
        );

      case 5:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">מה הכי אהבת?</h2>
            <p className="fb-q__hint">אפשר לבחור כמה שרוצים</p>
            <motion.div className="fb-q__tags" variants={stagger} initial="hidden" animate="show">
              {([
                { l: 'סווייפים', v: 'swipes' as FeatureKey },
                { l: 'צ׳אט', v: 'chat' as FeatureKey },
                { l: 'לראות לייקים', v: 'see_likes' as FeatureKey },
                { l: 'עיצוב', v: 'design' as FeatureKey },
                { l: 'הרעיון', v: 'concept' as FeatureKey },
                { l: 'האווירה', v: 'vibe' as FeatureKey },
                { l: 'שום דבר', v: 'nothing' as FeatureKey },
              ]).map((o) => (
                <Tag key={o.v} label={o.l} muted={o.v === 'nothing'} selected={favoriteFeatures.includes(o.v)} onClick={() => {
                  setFavoriteFeatures((prev) => {
                    let next: FeatureKey[];
                    if (o.v === 'nothing') { next = prev.includes('nothing') ? [] : ['nothing']; }
                    else { const c = prev.filter((f) => f !== 'nothing'); next = c.includes(o.v) ? c.filter((f) => f !== o.v) : [...c, o.v]; }
                    formRef.current.favoriteFeatures = next;
                    return next;
                  });
                }} />
              ))}
            </motion.div>
            {favoriteFeatures.length > 0 && (
              <motion.button className="fb-next" onClick={goNext} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.97 }}>
                המשך
              </motion.button>
            )}
          </div>
        );

      case 6:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">מה היית משפר?</h2>
            <p className="fb-q__hint">אופציונלי</p>
            <motion.div className="fb-q__input-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <textarea className="fb-textarea" value={improvement} onChange={(e) => { const v = e.target.value.slice(0, 500); setImprovement(v); formRef.current.improvement = v; }} placeholder="למשל: הייתי מוסיף..." maxLength={500} rows={4} />
              <span className="fb-textarea__count">{improvement.length}/500</span>
            </motion.div>
            <motion.button className="fb-next" onClick={goNext} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} whileTap={{ scale: 0.97 }}>
              {improvement ? 'המשך' : 'דלג'}
            </motion.button>
          </div>
        );

      case 7:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">היית ממליצ/ה?</h2>
            <motion.div className="fb-q__grid" variants={stagger} initial="hidden" animate="show">
              {[{ l: 'בטוח', v: 4 }, { l: 'כנראה שכן', v: 3 }, { l: 'לא בטוח/ה', v: 2 }, { l: 'לא נראה לי', v: 1 }].map((o) => (
                <OptionCard key={o.v} label={o.l} selected={recommendation === o.v} onClick={() => pick(() => { setRecommendation(o.v); formRef.current.recommendation = o.v; })} />
              ))}
            </motion.div>
          </div>
        );

      case 8:
        return (
          <div className="fb-q">
            <h2 className="fb-q__title">הכרת מישהו מעניין?</h2>
            <motion.div className="fb-q__grid fb-q__grid--3" variants={stagger} initial="hidden" animate="show">
              {([
                { l: 'כן', v: 'yes' as SuccessStoryAnswer },
                { l: 'אולי', v: 'maybe' as SuccessStoryAnswer },
                { l: 'לא הפעם', v: 'no' as SuccessStoryAnswer },
              ]).map((o) => (
                <OptionCard key={o.v} label={o.l} selected={successStory === o.v} onClick={() => {
                  setSuccessStory(o.v); formRef.current.successStory = o.v;
                  if (o.v !== 'yes') setTimeout(() => { setDirection(1); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }, 300);
                }} />
              ))}
            </motion.div>
            <AnimatePresence>
              {successStory === 'yes' && (
                <motion.div className="fb-followup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                  <p className="fb-followup__label">רוצה לשתף?</p>
                  <textarea className="fb-textarea" value={successStoryText} onChange={(e) => { const v = e.target.value.slice(0, 500); setSuccessStoryText(v); formRef.current.successStoryText = v; }} placeholder="קרה משהו מעניין..." maxLength={500} rows={3} />
                  <label className="fb-check">
                    <input type="checkbox" checked={allowPublish} onChange={(e) => { setAllowPublish(e.target.checked); formRef.current.allowStoryPublish = e.target.checked; }} />
                    <span className="fb-check__box" />
                    <span className="fb-check__text">אפשר להשתמש בסיפור באתר (בעילום שם)</span>
                  </label>
                  <motion.button className="fb-next" onClick={goNext} whileTap={{ scale: 0.97 }}>המשך</motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 9: {
        const EL: Record<number, string> = { 1: 'לא ממש', 2: 'סבבה', 3: 'נהניתי', 4: 'אהבתי' };
        const UL: Record<number, string> = { 1: 'מבלבל', 2: 'הסתדרתי', 3: 'ברור', 4: 'פשוט מאוד' };
        const ULL: Record<string, string> = { view_only: 'הסתכלתי', likes: 'לייקים', matches: 'התאמות', chat: 'צ׳אט' };
        const IL: Record<string, string> = { messages: 'הודעות', real_life: 'במציאות', interesting: 'מעניין', none: 'לא' };
        const RL: Record<number, string> = { 1: 'לא', 2: 'לא בטוח', 3: 'כנראה', 4: 'בטוח' };
        const FL: Record<string, string> = { swipes: 'סווייפים', chat: 'צ׳אט', see_likes: 'לייקים', design: 'עיצוב', concept: 'רעיון', vibe: 'אווירה', nothing: 'שום דבר' };

        const rows = [
          { k: 'הנאה', v: EL[enjoyment] || '—' },
          { k: 'קלות שימוש', v: UL[easeOfUse] || '—' },
          { k: 'רמת שימוש', v: ULL[usageLevel] || '—' },
          { k: 'קשר', v: IL[interactionResult] || '—' },
          { k: 'המלצה', v: RL[recommendation] || '—' },
          { k: 'מה אהבת', v: favoriteFeatures.map(f => FL[f] || f).join(', ') || '—' },
        ];

        return (
          <div className="fb-review">
            <motion.h2 className="fb-review__title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>סיכום</motion.h2>
            <motion.p className="fb-review__sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>אפשר לחזור אחורה לשנות</motion.p>
            <motion.div className="fb-review__list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {rows.map((r) => (
                <div key={r.k} className="fb-review__row">
                  <span className="fb-review__key">{r.k}</span>
                  <span className="fb-review__val">{r.v}</span>
                </div>
              ))}
            </motion.div>
            <motion.button className="fb-submit" onClick={handleSubmit} disabled={submitting} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} whileTap={{ scale: 0.97 }}>
              {submitting ? 'שולח...' : 'שלח משוב'}
            </motion.button>
            <motion.button className="fb-ghost" onClick={goBack} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              חזרה לשאלות
            </motion.button>
            {error && <motion.p className="fb-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
          </div>
        );
      }

      case 10:
        return (
          <div className="fb-finale">
            <motion.div className="fb-finale__glow" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE }} aria-hidden />
            <motion.h2 className="fb-finale__title" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: EASE }}>
              תודה רבה.
            </motion.h2>
            <motion.p className="fb-finale__sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              המשוב שלך עוזר לנו ליצור חוויות טובות יותר.
            </motion.p>

            {stats && (
              <motion.div className="fb-stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <span className="fb-stats__kicker">מספרים מהאירוע</span>
                <div className="fb-stats__row">
                  {[
                    { v: stats.participants, l: 'משתתפים' },
                    { v: stats.matches, l: 'התאמות' },
                    { v: stats.messages, l: 'הודעות' },
                  ].map((s, i) => (
                    <motion.div key={s.l} className="fb-stat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 + i * 0.1 }}>
                      <span className="fb-stat__num"><Counter value={s.v} /></span>
                      <span className="fb-stat__label">{s.l}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div className="fb-finale__actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}>
              <a href="/" className="fb-cta fb-cta--outline">לאתר Eventa</a>
            </motion.div>
            <motion.span className="fb-finale__credit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>Eventa</motion.span>
            {error && <motion.p className="fb-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fb-page">
      <div className="fb-ambient" aria-hidden><div className="fb-ambient__orb" /></div>
      <div className="fb-container">
        <Progress current={step} total={TOTAL_STEPS} />
        {step > 0 && step < TOTAL_STEPS - 1 && !submitted && (
          <button className="fb-back-btn" onClick={goBack} type="button" aria-label="חזור">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
        <div className="fb-stage">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" className="fb-step">
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
