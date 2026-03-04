'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

/* ━━━ Types ━━━ */
type UsageLevel = 'view_only' | 'likes' | 'matches' | 'chat';
type InteractionResult = 'messages' | 'real_life' | 'interesting' | 'none';
type SuccessStoryAnswer = 'yes' | 'maybe' | 'no';
type FeatureKey = 'swipes' | 'chat' | 'see_likes' | 'design' | 'concept' | 'vibe' | 'nothing';

interface EventStats {
  participants: number;
  matches: number;
  messages: number;
}

/* ━━━ Motion ━━━ */
const TOTAL = 11; // 0=intro, 1-8=questions, 9=review, 10=finale
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const slideVariants = {
  enter: (d: number) => ({ opacity: 0, y: d > 0 ? 80 : -80, scale: 0.96 }),
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
  exit: (d: number) => ({ opacity: 0, y: d > 0 ? -50 : 50, scale: 0.96, transition: { duration: 0.3, ease: EASE } }),
};

/* ━━━ Story Progress (Instagram-style segments) ━━━ */
function StoryBar({ current, total }: { current: number; total: number }) {
  const segments = total - 2; // exclude intro + finale
  if (current <= 0 || current >= total - 1) return null;
  return (
    <div className="story-bar" role="progressbar" aria-valuenow={current} aria-valuemax={segments}>
      {Array.from({ length: segments }, (_, i) => {
        const idx = i + 1; // segment i corresponds to slide i+1
        return (
          <div key={i} className="story-seg">
            <motion.div
              className="story-seg__fill"
              initial={false}
              animate={{ scaleX: current >= idx ? 1 : 0 }}
              transition={{ duration: current === idx ? 0.45 : 0.3, ease: EASE }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ━━━ Counter (animated number reveal) ━━━ */
function Counter({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const t = setTimeout(() => {
      const ctrl = animate(mv, value, { duration: 2.2, ease: [0.16, 1, 0.3, 1] });
      return () => ctrl.stop();
    }, delay);
    return () => clearTimeout(t);
  }, [mv, value, delay]);
  return <motion.span>{display}</motion.span>;
}

/* ━━━ Option (single-select, full-width) ━━━ */
function Option({ label, selected, onClick, index }: {
  label: string; selected: boolean; onClick: () => void; index: number;
}) {
  return (
    <motion.button
      className={`rc-opt${selected ? ' rc-opt--active' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.06, duration: 0.45, ease: EASE }}
      whileTap={{ scale: 0.97 }}
      type="button"
      aria-pressed={selected}
    >
      <span className="rc-opt__label">{label}</span>
      <span className="rc-opt__check" aria-hidden>
        {selected && (
          <motion.svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' as const, stiffness: 500, damping: 25 }}
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        )}
      </span>
    </motion.button>
  );
}

/* ━━━ Tag (multi-select chip) ━━━ */
function Tag({ label, selected, onClick, muted, index }: {
  label: string; selected: boolean; onClick: () => void; muted?: boolean; index: number;
}) {
  return (
    <motion.button
      className={`rc-tag${selected ? ' rc-tag--active' : ''}${muted ? ' rc-tag--muted' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.04, duration: 0.35, ease: EASE }}
      whileTap={{ scale: 0.94 }}
      type="button"
      aria-pressed={selected}
    >
      {label}
    </motion.button>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━ MAIN PAGE ━━━ */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function FeedbackPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = use(params);

  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState('');

  /* form state */
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

  /* navigation */
  const go = useCallback((d: 1 | -1) => {
    setDir(d);
    setSlide((s) => Math.max(0, Math.min(s + d, TOTAL - 1)));
  }, []);

  const next = useCallback(() => go(1), [go]);
  const back = useCallback(() => go(-1), [go]);

  /** Pick an option → brief highlight → auto-advance */
  const pick = useCallback((fn: () => void) => {
    fn();
    setTimeout(() => { setDir(1); setSlide((s) => Math.min(s + 1, TOTAL - 1)); }, 380);
  }, []);

  /* submit */
  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventSlug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enjoyment,
          easeOfUse,
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
      setDir(1);
      setSlide(TOTAL - 1);
    } catch {
      setError('שגיאה בחיבור');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, enjoyment, easeOfUse, usageLevel, interactionResult, favoriteFeatures, improvement, recommendation, successStory, successStoryText, allowPublish, eventSlug]);

  /* ━━━ Slides ━━━ */
  const renderSlide = () => {
    switch (slide) {

      /* ── 0 · Intro ── */
      case 0:
        return (
          <div className="rc-slide rc-slide--intro" role="button" tabIndex={0} onClick={next} onKeyDown={(e) => e.key === 'Enter' && next()}>
            <motion.div className="rc-badge" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
              <span className="rc-badge__dot" />
              אנונימי לגמרי
            </motion.div>

            <motion.h1 className="rc-hero" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.75, ease: EASE }}>
              הסיכום שלך
              <br />
              <span className="rc-hero__accent">מהערב.</span>
            </motion.h1>

            <motion.p className="rc-hero__sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
              כמה שאלות קצרות ואנונימיות.
              <br />
              בסוף — המספרים מהאירוע.
            </motion.p>

            <motion.div className="rc-tap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              <span className="rc-tap__ring" aria-hidden />
              הקש/י להתחלה
            </motion.div>
          </div>
        );

      /* ── 1 · Enjoyment ── */
      case 1:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              בוא/י נתחיל —
              <br />
              <span className="rc-q__big">איך היה?</span>
            </motion.h2>
            <div className="rc-opts">
              {[{ l: 'לא ממש', v: 1 }, { l: 'היה סבבה', v: 2 }, { l: 'נהניתי', v: 3 }, { l: 'אהבתי!', v: 4 }].map((o, i) => (
                <Option key={o.v} label={o.l} selected={enjoyment === o.v} index={i} onClick={() => pick(() => setEnjoyment(o.v))} />
              ))}
            </div>
          </div>
        );

      /* ── 2 · Ease of use ── */
      case 2:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              וכמה קל היה
              <br />
              <span className="rc-q__big">להשתמש?</span>
            </motion.h2>
            <div className="rc-opts">
              {[{ l: 'מבלבל', v: 1 }, { l: 'הסתדרתי', v: 2 }, { l: 'ברור', v: 3 }, { l: 'פשוט מאוד', v: 4 }].map((o, i) => (
                <Option key={o.v} label={o.l} selected={easeOfUse === o.v} index={i} onClick={() => pick(() => setEaseOfUse(o.v))} />
              ))}
            </div>
          </div>
        );

      /* ── 3 · Usage level ── */
      case 3:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              מה הספקת
              <br />
              <span className="rc-q__big">לעשות?</span>
            </motion.h2>
            <div className="rc-opts">
              {([
                { l: 'רק הסתכלתי', v: 'view_only' as UsageLevel },
                { l: 'שלחתי לייקים', v: 'likes' as UsageLevel },
                { l: 'היו לי התאמות', v: 'matches' as UsageLevel },
                { l: 'גם דיברתי בצ׳אט', v: 'chat' as UsageLevel },
              ]).map((o, i) => (
                <Option key={o.v} label={o.l} selected={usageLevel === o.v} index={i} onClick={() => pick(() => setUsageLevel(o.v))} />
              ))}
            </div>
          </div>
        );

      /* ── 4 · Interaction ── */
      case 4:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              ובאינטראקציות —
              <br />
              <span className="rc-q__big">מה קרה?</span>
            </motion.h2>
            <div className="rc-opts">
              {([
                { l: 'החלפנו הודעות', v: 'messages' as InteractionResult },
                { l: 'דיברנו במציאות', v: 'real_life' as InteractionResult },
                { l: 'מצאתי מישהו מעניין', v: 'interesting' as InteractionResult },
                { l: 'לא, אבל היה כיף', v: 'none' as InteractionResult },
              ]).map((o, i) => (
                <Option key={o.v} label={o.l} selected={interactionResult === o.v} index={i} onClick={() => pick(() => setInteractionResult(o.v))} />
              ))}
            </div>
          </div>
        );

      /* ── 5 · Favorite features (multi) ── */
      case 5:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              מה הכי עשה
              <br />
              <span className="rc-q__big">לך את זה?</span>
            </motion.h2>
            <motion.p className="rc-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              אפשר לבחור כמה שרוצים
            </motion.p>
            <div className="rc-tags">
              {([
                { l: 'סווייפים', v: 'swipes' as FeatureKey },
                { l: 'צ׳אט', v: 'chat' as FeatureKey },
                { l: 'לראות לייקים', v: 'see_likes' as FeatureKey },
                { l: 'עיצוב', v: 'design' as FeatureKey },
                { l: 'הרעיון', v: 'concept' as FeatureKey },
                { l: 'האווירה', v: 'vibe' as FeatureKey },
                { l: 'כלום', v: 'nothing' as FeatureKey },
              ]).map((o, i) => (
                <Tag
                  key={o.v} label={o.l} muted={o.v === 'nothing'} index={i}
                  selected={favoriteFeatures.includes(o.v)}
                  onClick={() => {
                    setFavoriteFeatures((prev) => {
                      if (o.v === 'nothing') return prev.includes('nothing') ? [] : ['nothing'];
                      const c = prev.filter((f) => f !== 'nothing');
                      return c.includes(o.v) ? c.filter((f) => f !== o.v) : [...c, o.v];
                    });
                  }}
                />
              ))}
            </div>
            {favoriteFeatures.length > 0 && (
              <motion.button className="rc-continue" onClick={next} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.97 }}>
                המשך
              </motion.button>
            )}
          </div>
        );

      /* ── 6 · Improvement (optional) ── */
      case 6:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              אם היית יכול/ה
              <br />
              <span className="rc-q__big">לשנות משהו...</span>
            </motion.h2>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <textarea
                className="rc-textarea"
                value={improvement}
                onChange={(e) => setImprovement(e.target.value.slice(0, 500))}
                placeholder="למשל: הייתי מוסיף..."
                maxLength={500}
                rows={4}
              />
              <span className="rc-textarea__count">{improvement.length}/500</span>
            </motion.div>
            <motion.button className="rc-continue" onClick={next} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} whileTap={{ scale: 0.97 }}>
              {improvement ? 'המשך' : 'דלג'}
            </motion.button>
          </div>
        );

      /* ── 7 · Recommendation ── */
      case 7:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              היית שולח/ת
              <br />
              <span className="rc-q__big">חבר/ה לאירוע?</span>
            </motion.h2>
            <div className="rc-opts">
              {[{ l: 'בטוח!', v: 4 }, { l: 'כנראה שכן', v: 3 }, { l: 'לא בטוח/ה', v: 2 }, { l: 'לא נראה לי', v: 1 }].map((o, i) => (
                <Option key={o.v} label={o.l} selected={recommendation === o.v} index={i} onClick={() => pick(() => setRecommendation(o.v))} />
              ))}
            </div>
          </div>
        );

      /* ── 8 · Success story ── */
      case 8:
        return (
          <div className="rc-slide">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              נוצר חיבור
              <br />
              <span className="rc-q__big">מיוחד?</span>
            </motion.h2>
            <div className="rc-opts rc-opts--3">
              {([
                { l: 'כן!', v: 'yes' as SuccessStoryAnswer },
                { l: 'אולי...', v: 'maybe' as SuccessStoryAnswer },
                { l: 'לא הפעם', v: 'no' as SuccessStoryAnswer },
              ]).map((o, i) => (
                <Option
                  key={o.v} label={o.l} selected={successStory === o.v} index={i}
                  onClick={() => {
                    setSuccessStory(o.v);
                    if (o.v !== 'yes') setTimeout(() => { setDir(1); setSlide((s) => Math.min(s + 1, TOTAL - 1)); }, 380);
                  }}
                />
              ))}
            </div>
            <AnimatePresence>
              {successStory === 'yes' && (
                <motion.div className="rc-followup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }}>
                  <p className="rc-followup__label">רוצה לשתף?</p>
                  <textarea className="rc-textarea" value={successStoryText} onChange={(e) => setSuccessStoryText(e.target.value.slice(0, 500))} placeholder="קרה משהו מעניין..." maxLength={500} rows={3} />
                  <label className="rc-check">
                    <input type="checkbox" checked={allowPublish} onChange={(e) => setAllowPublish(e.target.checked)} />
                    <span className="rc-check__box" />
                    <span className="rc-check__text">אפשר להשתמש בסיפור באתר (בעילום שם)</span>
                  </label>
                  <motion.button className="rc-continue" onClick={next} whileTap={{ scale: 0.97 }}>המשך</motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      /* ── 9 · Review + Submit ── */
      case 9: {
        const labels = {
          enjoy: { 1: 'לא ממש', 2: 'סבבה', 3: 'נהניתי', 4: 'אהבתי' } as Record<number, string>,
          ease: { 1: 'מבלבל', 2: 'הסתדרתי', 3: 'ברור', 4: 'פשוט מאוד' } as Record<number, string>,
          usage: { view_only: 'הסתכלתי', likes: 'לייקים', matches: 'התאמות', chat: 'צ׳אט' } as Record<string, string>,
          inter: { messages: 'הודעות', real_life: 'במציאות', interesting: 'מעניין', none: 'לא' } as Record<string, string>,
          rec: { 1: 'לא', 2: 'לא בטוח', 3: 'כנראה', 4: 'בטוח' } as Record<number, string>,
          feat: { swipes: 'סווייפים', chat: 'צ׳אט', see_likes: 'לייקים', design: 'עיצוב', concept: 'רעיון', vibe: 'אווירה', nothing: 'כלום' } as Record<string, string>,
        };
        const rows = [
          { k: 'הנאה', v: labels.enjoy[enjoyment] || '—' },
          { k: 'קלות', v: labels.ease[easeOfUse] || '—' },
          { k: 'שימוש', v: labels.usage[usageLevel] || '—' },
          { k: 'קשר', v: labels.inter[interactionResult] || '—' },
          { k: 'המלצה', v: labels.rec[recommendation] || '—' },
          { k: 'מה אהבת', v: favoriteFeatures.map((f) => labels.feat[f] || f).join(', ') || '—' },
        ];

        return (
          <div className="rc-slide rc-slide--review">
            <motion.h2 className="rc-q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="rc-q__big">הנה הסיכום.</span>
            </motion.h2>
            <motion.p className="rc-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              אפשר לחזור אחורה לשנות
            </motion.p>

            <motion.div className="rc-review" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              {rows.map((r) => (
                <div key={r.k} className="rc-review__row">
                  <span className="rc-review__key">{r.k}</span>
                  <span className="rc-review__val">{r.v}</span>
                </div>
              ))}
            </motion.div>

            <motion.button className="rc-submit" onClick={handleSubmit} disabled={submitting} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} whileTap={{ scale: 0.97 }}>
              {submitting ? (
                <span className="rc-submit__spinner" />
              ) : 'שלח משוב'}
            </motion.button>
            <motion.button className="rc-ghost" onClick={back} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}>
              חזרה לשאלות
            </motion.button>
            {error && <motion.p className="rc-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
          </div>
        );
      }

      /* ── 10 · Finale ── */
      case 10:
        return (
          <div className="rc-slide rc-slide--finale">
            <motion.div className="finale-glow" aria-hidden initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease: EASE }} />

            <motion.h2 className="finale-title" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.8, ease: EASE }}>
              תודה רבה.
            </motion.h2>
            <motion.p className="finale-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
              המשוב שלך עוזר לנו ליצור
              <br />
              חוויות טובות יותר.
            </motion.p>

            {stats && (
              <motion.div className="finale-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                <span className="finale-stats__kicker">המספרים מהערב</span>
                <div className="finale-stats__grid">
                  {[
                    { v: stats.participants, l: 'משתתפים' },
                    { v: stats.matches, l: 'התאמות' },
                    { v: stats.messages, l: 'הודעות' },
                  ].map((s, i) => (
                    <motion.div
                      key={s.l} className="finale-stat"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.14, duration: 0.6, ease: EASE }}
                    >
                      <span className="finale-stat__num"><Counter value={s.v} delay={900 + i * 160} /></span>
                      <span className="finale-stat__label">{s.l}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div className="finale-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: stats ? 1.3 : 0.75 }}>
              <a href="/" className="rc-cta">לאתר Eventa</a>
            </motion.div>

            <motion.span className="finale-credit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: stats ? 1.5 : 0.95 }}>
              Eventa
            </motion.span>
          </div>
        );

      default:
        return null;
    }
  };

  /* ━━━ Render ━━━ */
  return (
    <div className="recap" data-slide={slide}>
      {/* background gradient layer */}
      <div className="recap__bg" aria-hidden>
        <div className="recap__gradient" />
      </div>

      {/* story bar */}
      <StoryBar current={slide} total={TOTAL} />

      {/* back button */}
      {slide > 0 && slide < TOTAL - 1 && !submitted && (
        <button className="recap__back" onClick={back} type="button" aria-label="חזור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* slide stage */}
      <div className="recap__stage">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slide}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="recap__step"
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
