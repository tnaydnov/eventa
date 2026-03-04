'use client';

import { use, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

/* ─── Types ─── */
type UsageLevel = 'view_only' | 'likes' | 'matches' | 'chat';
type InteractionResult = 'messages' | 'real_life' | 'interesting' | 'none';
type SuccessStoryAnswer = 'yes' | 'maybe' | 'no';
type FeatureKey = 'swipes' | 'chat' | 'see_likes' | 'design' | 'concept' | 'vibe' | 'nothing';

interface FeedbackData {
  enjoyment: number;
  easeOfUse: number;
  usageLevel: UsageLevel;
  interactionResult: InteractionResult;
  favoriteFeatures: FeatureKey[];
  improvement: string;
  recommendation: number;
  successStory: SuccessStoryAnswer | null;
  successStoryText: string;
  allowStoryPublish: boolean;
}

interface EventStats {
  participants: number;
  matches: number;
  messages: number;
}

/* ─── Constants ─── */
const TOTAL_STEPS = 11; // 0=intro … 8=questions, 9=review, 10=finale

/* Step transition variants */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stepVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 80 : -80,
    scale: 0.95,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -80 : 80,
    scale: 0.95,
    transition: { duration: 0.25, ease: EASE_OUT },
  }),
};

/* Stagger children for answer options */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 400, damping: 28 } },
};

/* ─── Confetti burst component ─── */
function ConfettiBurst() {
  const pieces = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * 360;
    const distance = 60 + Math.random() * 120;
    const rad = (angle * Math.PI) / 180;
    return {
      id: i,
      x: Math.cos(rad) * distance,
      y: Math.sin(rad) * distance - 40,
      rotate: Math.random() * 720 - 360,
      scale: 0.5 + Math.random() * 0.8,
      color: ['#D4A59A', '#E8C4BB', '#C9A580', '#B8877C', '#D4B896', '#C4A699', '#E0CFC6'][i % 7],
      delay: Math.random() * 0.2,
    };
  });

  return (
    <div className="fb-confetti" aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="fb-confetti-piece"
          style={{ background: p.color }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotate: p.rotate,
          }}
          transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Animated counter ─── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `${Math.round(v).toLocaleString()}${suffix}`);

  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.5, ease: 'easeOut' });
    return () => ctrl.stop();
  }, [mv, value]);

  return <motion.span>{display}</motion.span>;
}

/* ─── Progress Bar ─── */
function ProgressDots({ current, total }: { current: number; total: number }) {
  const steps = total - 2; // question steps 1..8 = 8 steps
  const active = current - 1;

  if (current === 0 || current >= total - 1) return null; // Don't show on intro or finale

  return (
    <div className="fb-progress" role="progressbar" aria-valuenow={current} aria-valuemax={total - 2}>
      <div className="fb-progress-track">
        <motion.div
          className="fb-progress-fill"
          initial={false}
          animate={{ scaleX: Math.max(0, active / steps) }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="fb-progress-label">
        {current <= total - 2 && <span>{current} / {total - 2}</span>}
      </div>
    </div>
  );
}

/* ─── Emoji Button (single select) ─── */
function EmojiButton({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      className={`fb-emoji-btn${selected ? ' fb-emoji-btn--selected' : ''}`}
      onClick={onClick}
      variants={itemVariants}
      whileTap={{ scale: 0.92 }}
      type="button"
      aria-pressed={selected}
    >
      <span className="fb-emoji-btn__icon">{emoji}</span>
      <span className="fb-emoji-btn__label">{label}</span>
      {selected && (
        <motion.div
          className="fb-emoji-btn__glow"
          layoutId="emoji-glow"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </motion.button>
  );
}

/* ─── Multi-select pill ─── */
function FeaturePill({
  emoji,
  label,
  selected,
  onClick,
  isNothing,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  isNothing?: boolean;
}) {
  return (
    <motion.button
      className={`fb-pill${selected ? ' fb-pill--selected' : ''}${isNothing ? ' fb-pill--nothing' : ''}`}
      onClick={onClick}
      variants={itemVariants}
      whileTap={{ scale: 0.95 }}
      type="button"
      aria-pressed={selected}
    >
      <span className="fb-pill__emoji">{emoji}</span>
      <span>{label}</span>
      {selected && (
        <motion.span
          className="fb-pill__check"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  icon,
  value,
  label,
  suffix,
  delay,
}: {
  icon: string;
  value: number;
  label: string;
  suffix?: string;
  delay: number;
}) {
  return (
    <motion.div
      className="fb-stat-card"
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="fb-stat-card__icon">{icon}</span>
      <span className="fb-stat-card__value">
        <AnimatedNumber value={value} suffix={suffix} />
      </span>
      <span className="fb-stat-card__label">{label}</span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Main Feedback Page
   ═══════════════════════════════════════════ */
export default function FeedbackPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<FeedbackData>({
    enjoyment: 0,
    easeOfUse: 0,
    usageLevel: 'view_only',
    interactionResult: 'none',
    favoriteFeatures: [],
    improvement: '',
    recommendation: 0,
    successStory: null,
    successStoryText: '',
    allowStoryPublish: false,
  });

  // Track selection state for re-rendering
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

  /* ── Navigation ── */
  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0: return true; // intro
      case 1: return enjoyment > 0;
      case 2: return easeOfUse > 0;
      case 3: return usageLevel !== '';
      case 4: return interactionResult !== '';
      case 5: return favoriteFeatures.length > 0;
      case 6: return true; // optional
      case 7: return recommendation > 0;
      case 8: return true; // optional (success story)
      case 9: return true; // review
      case 10: return true; // finale
      default: return false;
    }
  }, [step, enjoyment, easeOfUse, usageLevel, interactionResult, favoriteFeatures, recommendation]);

  const goNext = useCallback(() => {
    if (!canProceed()) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [canProceed]);

  const goBack = useCallback(() => {
    if (step <= 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  }, [step]);

  /* ── Auto-advance on single-select ── */
  const selectAndAdvance = useCallback((setter: () => void) => {
    setter();
    // Small delay so user sees their selection highlight
    setTimeout(() => {
      setDirection(1);
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }, 350);
  }, []);

  /* ── Submit ── */
  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError('');

    const payload = {
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
    };

    try {
      const res = await fetch(`/api/events/${eventSlug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'שגיאה' }));
        setError(msg || 'שגיאה בשליחה');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setShowConfetti(true);

      // Fetch stats for the final screen
      try {
        const statsRes = await fetch(`/api/events/${eventSlug}/stats`);
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch { /* stats are nice-to-have */ }

      // Move to stats screen
      setDirection(1);
      setStep(TOTAL_STEPS - 1);
    } catch {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting, submitted, enjoyment, easeOfUse, usageLevel,
    interactionResult, favoriteFeatures, improvement, recommendation,
    successStory, successStoryText, allowPublish, eventSlug,
  ]);

  /* ── Submit is now triggered explicitly from review step ── */

  /* ─── Step renderers ─── */

  const renderStep = () => {
    switch (step) {
      /* ── Step 0: Intro ── */
      case 0:
        return (
          <div className="fb-intro">
            <motion.div
              className="fb-intro__badge"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              ✦ משוב אנונימי
            </motion.div>
            <motion.h1
              className="fb-intro__title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              תודה <span className="fb-intro__accent">שהשתתפת</span>
            </motion.h1>
            <motion.div
              className="fb-intro__divider"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
            <motion.p
              className="fb-intro__sub"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              נשמח לשמוע איך היה לך.
              <br />
              הסקר קצר ואנונימי לחלוטין.
            </motion.p>
            <motion.p
              className="fb-intro__tease"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              בסוף תראה סטטיסטיקות מהאירוע
            </motion.p>
            <motion.button
              className="fb-start-btn"
              onClick={goNext}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileTap={{ scale: 0.95 }}
            >
              בואו נתחיל
              <span className="fb-start-btn__arrow">←</span>
            </motion.button>
          </div>
        );

      /* ── Step 1: Enjoyment ── */
      case 1:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">כמה נהנית מהאפליקציה?</h2>
            <motion.div className="fb-options" variants={containerVariants} initial="hidden" animate="show">
              {[
                { emoji: '😕', label: 'לא ממש', value: 1 },
                { emoji: '🙂', label: 'היה סבבה', value: 2 },
                { emoji: '😄', label: 'נהניתי', value: 3 },
                { emoji: '😍', label: 'ממש אהבתי', value: 4 },
              ].map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={enjoyment === opt.value}
                  onClick={() => selectAndAdvance(() => {
                    setEnjoyment(opt.value);
                    formRef.current.enjoyment = opt.value;
                  })}
                />
              ))}
            </motion.div>
          </div>
        );

      /* ── Step 2: Ease of Use ── */
      case 2:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">כמה היה קל להשתמש?</h2>
            <motion.div className="fb-options" variants={containerVariants} initial="hidden" animate="show">
              {[
                { emoji: '😵', label: 'לא הבנתי', value: 1 },
                { emoji: '🙂', label: 'הסתדרתי', value: 2 },
                { emoji: '👌', label: 'היה ברור', value: 3 },
                { emoji: '🚀', label: 'סופר פשוט', value: 4 },
              ].map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={easeOfUse === opt.value}
                  onClick={() => selectAndAdvance(() => {
                    setEaseOfUse(opt.value);
                    formRef.current.easeOfUse = opt.value;
                  })}
                />
              ))}
            </motion.div>
          </div>
        );

      /* ── Step 3: Usage Level ── */
      case 3:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">כמה השתמשת באפליקציה?</h2>
            <motion.div className="fb-options" variants={containerVariants} initial="hidden" animate="show">
              {([
                { emoji: '👀', label: 'רק הסתכלתי', value: 'view_only' as UsageLevel },
                { emoji: '👍', label: 'שלחתי כמה לייקים', value: 'likes' as UsageLevel },
                { emoji: '💘', label: 'היו לי התאמות', value: 'matches' as UsageLevel },
                { emoji: '💬', label: 'גם דיברתי בצ׳אט', value: 'chat' as UsageLevel },
              ]).map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={usageLevel === opt.value}
                  onClick={() => selectAndAdvance(() => {
                    setUsageLevel(opt.value);
                    formRef.current.usageLevel = opt.value;
                  })}
                />
              ))}
            </motion.div>
          </div>
        );

      /* ── Step 4: Interaction Result ── */
      case 4:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">האם יצרת קשר עם מישהו?</h2>
            <motion.div className="fb-options" variants={containerVariants} initial="hidden" animate="show">
              {([
                { emoji: '💬', label: 'החלפנו הודעות', value: 'messages' as InteractionResult },
                { emoji: '😏', label: 'גם דיברנו במציאות', value: 'real_life' as InteractionResult },
                { emoji: '😉', label: 'מצאתי מישהו מעניין', value: 'interesting' as InteractionResult },
                { emoji: '🙂', label: 'לא, אבל היה נחמד', value: 'none' as InteractionResult },
              ]).map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={interactionResult === opt.value}
                  onClick={() => selectAndAdvance(() => {
                    setInteractionResult(opt.value);
                    formRef.current.interactionResult = opt.value;
                  })}
                />
              ))}
            </motion.div>
          </div>
        );

      /* ── Step 5: Favorite Feature (multi-select) ── */
      case 5:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">מה הכי אהבת?</h2>
            <p className="fb-question__hint">אפשר לבחור כמה שרוצים</p>
            <motion.div className="fb-pills" variants={containerVariants} initial="hidden" animate="show">
              {([
                { emoji: '🔄', label: 'הסווייפים', value: 'swipes' as FeatureKey },
                { emoji: '💬', label: 'הצ׳אט', value: 'chat' as FeatureKey },
                { emoji: '👀', label: 'לראות מי עשה לי לייק', value: 'see_likes' as FeatureKey },
                { emoji: '🎨', label: 'העיצוב', value: 'design' as FeatureKey },
                { emoji: '💡', label: 'הרעיון עצמו', value: 'concept' as FeatureKey },
                { emoji: '🎉', label: 'האווירה שזה יצר', value: 'vibe' as FeatureKey },
                { emoji: '🚫', label: 'לא אהבתי כלום', value: 'nothing' as FeatureKey },
              ]).map((opt) => (
                <FeaturePill
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  isNothing={opt.value === 'nothing'}
                  selected={favoriteFeatures.includes(opt.value)}
                  onClick={() => {
                    setFavoriteFeatures((prev) => {
                      let next: FeatureKey[];
                      if (opt.value === 'nothing') {
                        // Exclusive: selecting "nothing" clears everything else
                        next = prev.includes('nothing') ? [] : ['nothing'];
                      } else {
                        // Selecting any feature clears "nothing"
                        const withoutNothing = prev.filter((f) => f !== 'nothing');
                        next = withoutNothing.includes(opt.value)
                          ? withoutNothing.filter((f) => f !== opt.value)
                          : [...withoutNothing, opt.value];
                      }
                      formRef.current.favoriteFeatures = next;
                      return next;
                    });
                  }}
                />
              ))}
            </motion.div>
            {favoriteFeatures.length > 0 && (
              <motion.button
                className="fb-next-btn"
                onClick={goNext}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
              >
                המשך
              </motion.button>
            )}
          </div>
        );

      /* ── Step 6: Improvements (optional text) ── */
      case 6:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">יש משהו שהיית משפר?</h2>
            <p className="fb-question__hint">אופציונלי — אבל נשמח לשמוע</p>
            <motion.div
              className="fb-text-area-wrap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <textarea
                className="fb-textarea"
                value={improvement}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 500);
                  setImprovement(val);
                  formRef.current.improvement = val;
                }}
                placeholder="למשל: הייתי מוסיף/ה..."
                maxLength={500}
                rows={4}
              />
              <span className="fb-textarea__count">{improvement.length}/500</span>
            </motion.div>
            <motion.button
              className="fb-next-btn"
              onClick={goNext}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              whileTap={{ scale: 0.95 }}
            >
              {improvement ? 'המשך' : 'דלג'}
            </motion.button>
          </div>
        );

      /* ── Step 7: Recommendation ── */
      case 7:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">היית ממליץ/ה על האפליקציה?</h2>
            <motion.div className="fb-options" variants={containerVariants} initial="hidden" animate="show">
              {[
                { emoji: '🔥', label: 'בטוח!', value: 4 },
                { emoji: '🙂', label: 'כנראה שכן', value: 3 },
                { emoji: '🤔', label: 'לא בטוח', value: 2 },
                { emoji: '😅', label: 'לא נראה לי', value: 1 },
              ].map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={recommendation === opt.value}
                  onClick={() => selectAndAdvance(() => {
                    setRecommendation(opt.value);
                    formRef.current.recommendation = opt.value;
                  })}
                />
              ))}
            </motion.div>
          </div>
        );

      /* ── Step 8: Success Story ── */
      case 8:
        return (
          <div className="fb-question">
            <h2 className="fb-question__title">הכרת מישהו מעניין?</h2>
            <motion.div className="fb-options fb-options--compact" variants={containerVariants} initial="hidden" animate="show">
              {([
                { emoji: '😄', label: 'כן!', value: 'yes' as SuccessStoryAnswer },
                { emoji: '😉', label: 'אולי...', value: 'maybe' as SuccessStoryAnswer },
                { emoji: '🙃', label: 'לא הפעם', value: 'no' as SuccessStoryAnswer },
              ]).map((opt) => (
                <EmojiButton
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={successStory === opt.value}
                  onClick={() => {
                    setSuccessStory(opt.value);
                    formRef.current.successStory = opt.value;
                    // Don't auto-advance on "yes" — show follow-up
                    if (opt.value !== 'yes') {
                      setTimeout(() => {
                        setDirection(1);
                        setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
                      }, 350);
                    }
                  }}
                />
              ))}
            </motion.div>

            {/* Follow-up if they said yes */}
            <AnimatePresence>
              {successStory === 'yes' && (
                <motion.div
                  className="fb-followup"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="fb-followup__prompt">רוצה לשתף קצת? 💕</p>
                  <textarea
                    className="fb-textarea"
                    value={successStoryText}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 500);
                      setSuccessStoryText(val);
                      formRef.current.successStoryText = val;
                    }}
                    placeholder="קרה משהו מענין..."
                    maxLength={500}
                    rows={3}
                  />
                  <label className="fb-checkbox">
                    <input
                      type="checkbox"
                      checked={allowPublish}
                      onChange={(e) => {
                        setAllowPublish(e.target.checked);
                        formRef.current.allowStoryPublish = e.target.checked;
                      }}
                    />
                    <span className="fb-checkbox__box" />
                    <span className="fb-checkbox__text">
                      אפשר להשתמש בסיפור באתר שלנו (בעילום שם)
                    </span>
                  </label>
                  <motion.button
                    className="fb-next-btn"
                    onClick={goNext}
                    whileTap={{ scale: 0.95 }}
                  >
                    המשך
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      /* ── Step 9: Review + Submit ── */
      case 9: {
        const ENJOYMENT_MAP: Record<number, string> = { 1: '😕 לא ממש', 2: '🙂 סבבה', 3: '😄 נהניתי', 4: '😍 אהבתי' };
        const EASE_MAP: Record<number, string> = { 1: '😵 לא הבנתי', 2: '🙂 הסתדרתי', 3: '👌 ברור', 4: '🚀 פשוט' };
        const USAGE_MAP: Record<string, string> = { view_only: '👀 הסתכלתי', likes: '👍 לייקים', matches: '💘 התאמות', chat: '💬 צ׳אט' };
        const INTERACTION_MAP: Record<string, string> = { messages: '💬 הודעות', real_life: '😏 במציאות', interesting: '😉 מעניין', none: '🙂 לא' };
        const REC_MAP: Record<number, string> = { 1: '😅 לא', 2: '🤔 לא בטוח', 3: '🙂 כנראה', 4: '🔥 בטוח' };

        const summaryItems = [
          { icon: '😊', label: 'הנאה', value: ENJOYMENT_MAP[enjoyment] || '—' },
          { icon: '✨', label: 'שימוש', value: EASE_MAP[easeOfUse] || '—' },
          { icon: '📱', label: 'רמת שימוש', value: USAGE_MAP[usageLevel] || '—' },
          { icon: '💬', label: 'קשר', value: INTERACTION_MAP[interactionResult] || '—' },
          { icon: '🔥', label: 'המלצה', value: REC_MAP[recommendation] || '—' },
          { icon: '❤️', label: 'אהבתי', value: favoriteFeatures.includes('nothing') ? 'כלום' : favoriteFeatures.length > 0 ? `${favoriteFeatures.length} דברים` : '—' },
        ];

        return (
          <div className="fb-review">
            <motion.h2
              className="fb-review__title"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              סיכום התשובות
            </motion.h2>
            <motion.p
              className="fb-review__subtitle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              אפשר לחזור אחורה לשנות
            </motion.p>

            <motion.div
              className="fb-review__grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {summaryItems.map((item) => (
                <div key={item.label} className="fb-review__item">
                  <span className="fb-review__item-icon">{item.icon}</span>
                  <div className="fb-review__item-content">
                    <span className="fb-review__item-label">{item.label}</span>
                    <span className="fb-review__item-value">{item.value}</span>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.button
              className="fb-submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileTap={{ scale: 0.97 }}
            >
              {submitting ? 'שולח...' : 'שלח משוב'}
            </motion.button>

            <motion.button
              className="fb-send-back-btn"
              onClick={goBack}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              ← חזרה לשאלות
            </motion.button>

            {error && (
              <motion.p
                className="fb-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.p>
            )}
          </div>
        );
      }

      /* ── Step 10: Finale ── */
      case 10:
        return (
          <div className="fb-finale">
            {showConfetti && <ConfettiBurst />}
            <div className="fb-finale__glow" />
            <motion.div
              className="fb-finale__line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            />
            <motion.h2
              className="fb-finale__title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              תודה <span className="fb-finale__title-accent">רבה</span>
            </motion.h2>
            <motion.p
              className="fb-finale__sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              המשוב שלך עוזר לנו ליצור חוויות טובות יותר
            </motion.p>

            {stats && (
              <motion.div
                className="fb-stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="fb-stats__label">סטטיסטיקות מהאירוע</p>
                <div className="fb-stats__grid">
                  <StatCard
                    icon="👥"
                    value={stats.participants}
                    label="משתתפים"
                    delay={0.6}
                  />
                  <StatCard
                    icon="💘"
                    value={stats.matches}
                    label="התאמות"
                    delay={0.75}
                  />
                  <StatCard
                    icon="💬"
                    value={stats.messages}
                    label="הודעות"
                    delay={0.9}
                  />
                </div>
              </motion.div>
            )}

            <motion.div
              className="fb-finale__actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <a href="/" className="fb-website-btn">
                לאתר Eventa
                <span>→</span>
              </a>
              <p className="fb-finale__credit">
                made with ❤️ by Eventa
              </p>
            </motion.div>

            {error && (
              <motion.p
                className="fb-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fb-page">
      {/* Ambient background */}
      <div className="fb-ambient" aria-hidden>
        <div className="fb-ambient__orb fb-ambient__orb--1" />
        <div className="fb-ambient__orb fb-ambient__orb--2" />
        <div className="fb-ambient__orb fb-ambient__orb--3" />
      </div>

      {/* Floating particles */}
      <div className="fb-particles" aria-hidden>
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="fb-particle"
            style={{
              left: `${((i * 37 + 13) % 100)}%`,
              top: `${((i * 53 + 7) % 100)}%`,
              width: `${1.5 + (i % 3) * 0.8}px`,
              height: `${1.5 + (i % 3) * 0.8}px`,
              animationDelay: `${(i * 0.7) % 8}s`,
              animationDuration: `${6 + (i % 5) * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="fb-container">
        {/* Progress */}
        <ProgressDots current={step} total={TOTAL_STEPS} />

        {/* Back button (not on intro or finale) */}
        {step > 0 && step < TOTAL_STEPS - 1 && !submitted && (
          <button className="fb-back" onClick={goBack} type="button" aria-label="חזור">
            →
          </button>
        )}

        {/* Step content */}
        <div className="fb-stage">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="fb-step"
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
