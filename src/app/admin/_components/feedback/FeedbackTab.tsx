'use client';

import { useState, useEffect } from 'react';
import {
  adminFetch,
  type FeedbackData,
  type FeedbackResponse,
  USAGE_LEVEL_LABELS,
  INTERACTION_RESULT_LABELS,
  FEATURE_LABELS,
  ENJOYMENT_EMOJIS,
  RECOMMENDATION_EMOJIS,
  SUCCESS_STORY_LABELS,
} from '../shared';

/* ─── Rating bar visual ─── */
function RatingBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="afb-rating-bar">
      <div className="afb-rating-bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ─── Distribution chart (horizontal bars) ─── */
function DistributionChart({
  data,
  labels,
  emojis,
  color = 'var(--admin-accent)',
}: {
  data: Record<string | number, number>;
  labels?: Record<string | number, string>;
  emojis?: Record<string | number, string>;
  color?: string;
}) {
  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="afb-dist-chart">
      {entries.map(([key, count]) => (
        <div key={key} className="afb-dist-row">
          <span className="afb-dist-label">
            {emojis?.[key] && <span className="afb-dist-emoji">{emojis[key]}</span>}
            {labels?.[key] ?? key}
          </span>
          <div className="afb-dist-bar-wrap">
            <RatingBar value={count} max={maxVal} color={color} />
          </div>
          <span className="afb-dist-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Single response card ─── */
function ResponseCard({ response, index }: { response: FeedbackResponse; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(response.createdAt);
  const dateStr = date.toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="afb-response-card">
      <button
        className="afb-response-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
      >
        <div className="afb-response-header__right">
          <span className="afb-response-num">#{index + 1}</span>
          <span className="afb-response-date">{dateStr}</span>
        </div>
        <div className="afb-response-header__left">
          <span className="afb-response-score">
            {ENJOYMENT_EMOJIS[response.enjoyment]} הנאה {response.enjoyment}/4
          </span>
          <span className="afb-response-score">
            {RECOMMENDATION_EMOJIS[response.recommendation]} המלצה {response.recommendation}/4
          </span>
          <span className={`afb-expand-icon ${expanded ? 'afb-expand-icon--open' : ''}`}>▸</span>
        </div>
      </button>

      {expanded && (
        <div className="afb-response-body">
          <div className="afb-response-grid">
            <div className="afb-response-field">
              <span className="afb-response-field__label">😊 הנאה</span>
              <span className="afb-response-field__value">{ENJOYMENT_EMOJIS[response.enjoyment]} {response.enjoyment}/4</span>
            </div>
            <div className="afb-response-field">
              <span className="afb-response-field__label">📱 קלות שימוש</span>
              <span className="afb-response-field__value">{ENJOYMENT_EMOJIS[response.easeOfUse]} {response.easeOfUse}/4</span>
            </div>
            <div className="afb-response-field">
              <span className="afb-response-field__label">💬 רמת שימוש</span>
              <span className="afb-response-field__value">{USAGE_LEVEL_LABELS[response.usageLevel] ?? response.usageLevel}</span>
            </div>
            <div className="afb-response-field">
              <span className="afb-response-field__label">❤️ תוצאת אינטראקציה</span>
              <span className="afb-response-field__value">{INTERACTION_RESULT_LABELS[response.interactionResult] ?? response.interactionResult}</span>
            </div>
            <div className="afb-response-field">
              <span className="afb-response-field__label">🔥 המלצה</span>
              <span className="afb-response-field__value">{RECOMMENDATION_EMOJIS[response.recommendation]} {response.recommendation}/4</span>
            </div>
            <div className="afb-response-field">
              <span className="afb-response-field__label">🌟 סיפור הצלחה</span>
              <span className="afb-response-field__value">{response.successStory ? SUCCESS_STORY_LABELS[response.successStory] ?? response.successStory : '—'}</span>
            </div>
          </div>

          {response.favoriteFeatures.length > 0 && (
            <div className="afb-response-features">
              <span className="afb-response-field__label">⭐ פיצ׳רים אהובים</span>
              <div className="afb-feature-pills">
                {response.favoriteFeatures.map(f => (
                  <span key={f} className="afb-feature-pill">{FEATURE_LABELS[f] ?? f}</span>
                ))}
              </div>
            </div>
          )}

          {response.improvementText && (
            <div className="afb-response-text-block">
              <span className="afb-response-field__label">💡 הצעה לשיפור</span>
              <p className="afb-response-text">{response.improvementText}</p>
            </div>
          )}

          {response.successStoryText && (
            <div className="afb-response-text-block">
              <span className="afb-response-field__label">🌟 פרטי סיפור הצלחה</span>
              <p className="afb-response-text">{response.successStoryText}</p>
              {response.allowStoryPublish && (
                <span className="afb-publish-badge">✅ מאשר/ת פרסום</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Main FeedbackTab Component
   ══════════════════════════════════════════ */
export default function FeedbackTab({ eventId, eventSlug }: { eventId: string; eventSlug: string }) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminFetch(`/api/admin/events/${eventId}/feedback`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setData(await res.json());
        } else {
          setError('שגיאה בטעינת נתוני פידבק');
        }
      })
      .catch(() => { if (!cancelled) setError('שגיאת תקשורת'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [eventId]);

  const feedbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dating/${eventSlug}/feedback`
    : `/dating/${eventSlug}/feedback`;

  const copyLink = () => {
    navigator.clipboard.writeText(feedbackUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="ea-loading">
        <div className="admin-skeleton admin-skeleton--card" />
        <div className="admin-skeleton" style={{ height: 120 }} />
        <div className="admin-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (error) {
    return <div className="ced-error" role="alert">{error}</div>;
  }

  const agg = data?.aggregates;
  const total = data?.totalResponses ?? 0;

  return (
    <div className="afb-root">
      {/* ─── Feedback Link ─── */}
      <div className="afb-link-card">
        <div className="afb-link-card__header">
          <span className="afb-link-card__icon">🔗</span>
          <div>
            <h3 className="afb-link-card__title">קישור לסקר פידבק</h3>
            <p className="afb-link-card__desc">שלח/י קישור זה למשתתפים אחרי האירוע</p>
          </div>
        </div>
        <div className="afb-link-card__url-row">
          <input
            className="afb-link-input"
            value={feedbackUrl}
            readOnly
            onClick={e => (e.target as HTMLInputElement).select()}
            aria-label="קישור לסקר פידבק"
          />
          <button
            className={`admin-btn admin-btn--sm ${copied ? 'admin-btn--green' : 'admin-btn--primary'}`}
            onClick={copyLink}
          >
            {copied ? '✅ הועתק!' : '📋 העתק'}
          </button>
        </div>
      </div>

      {/* ─── Summary Stats ─── */}
      <div className="afb-stats-grid">
        <div className="afb-stat-card">
          <span className="afb-stat-card__icon">📝</span>
          <span className="afb-stat-card__value">{total}</span>
          <span className="afb-stat-card__label">תשובות</span>
        </div>
        {agg && (
          <>
            <div className="afb-stat-card">
              <span className="afb-stat-card__icon">😊</span>
              <span className="afb-stat-card__value">{agg.enjoymentAvg.toFixed(1)}</span>
              <span className="afb-stat-card__label">ממוצע הנאה</span>
            </div>
            <div className="afb-stat-card">
              <span className="afb-stat-card__icon">📱</span>
              <span className="afb-stat-card__value">{agg.easeOfUseAvg.toFixed(1)}</span>
              <span className="afb-stat-card__label">קלות שימוש</span>
            </div>
            <div className="afb-stat-card">
              <span className="afb-stat-card__icon">🔥</span>
              <span className="afb-stat-card__value">{agg.recommendationAvg.toFixed(1)}</span>
              <span className="afb-stat-card__label">ממוצע המלצה</span>
            </div>
          </>
        )}
      </div>

      {total === 0 && (
        <div className="afb-empty">
          <div className="afb-empty__icon">📭</div>
          <h3 className="afb-empty__title">עדיין אין תשובות</h3>
          <p className="afb-empty__text">שלח/י את קישור הפידבק למשתתפים כדי להתחיל לקבל תגובות</p>
        </div>
      )}

      {total > 0 && agg && (
        <>
          {/* ─── Charts Section ─── */}
          <div className="ea-section">
            <h3 className="ea-section__title">📊 התפלגויות</h3>
            <div className="afb-charts-grid">
              {/* Enjoyment distribution */}
              <div className="afb-chart-card">
                <h4 className="afb-chart-card__title">😊 רמת הנאה</h4>
                <DistributionChart
                  data={agg.enjoymentDist}
                  emojis={ENJOYMENT_EMOJIS}
                  labels={{ 1: 'סביר', 2: 'כיף', 3: 'מצוין', 4: 'מטורף' }}
                  color="var(--admin-green)"
                />
              </div>

              {/* Recommendation distribution */}
              <div className="afb-chart-card">
                <h4 className="afb-chart-card__title">🔥 רמת המלצה</h4>
                <DistributionChart
                  data={agg.recommendationDist}
                  emojis={RECOMMENDATION_EMOJIS}
                  labels={{ 1: 'לא', 2: 'אולי', 3: 'כן', 4: 'בהחלט' }}
                  color="var(--admin-orange)"
                />
              </div>

              {/* Usage level distribution */}
              <div className="afb-chart-card">
                <h4 className="afb-chart-card__title">💬 רמת שימוש</h4>
                <DistributionChart
                  data={agg.usageLevels}
                  labels={USAGE_LEVEL_LABELS}
                  color="var(--admin-blue)"
                />
              </div>

              {/* Interaction result distribution */}
              <div className="afb-chart-card">
                <h4 className="afb-chart-card__title">❤️ תוצאת אינטראקציה</h4>
                <DistributionChart
                  data={agg.interactionResults}
                  labels={INTERACTION_RESULT_LABELS}
                  color="var(--admin-purple)"
                />
              </div>
            </div>
          </div>

          {/* ─── Feature Popularity ─── */}
          {Object.keys(agg.featureFrequency).length > 0 && (
            <div className="ea-section">
              <h3 className="ea-section__title">⭐ פיצ׳רים פופולריים</h3>
              <div className="afb-chart-card">
                <DistributionChart
                  data={agg.featureFrequency}
                  labels={FEATURE_LABELS}
                  color="var(--admin-pink)"
                />
              </div>
            </div>
          )}

          {/* ─── Success Stories ─── */}
          <div className="ea-section">
            <h3 className="ea-section__title">🌟 סיפורי הצלחה</h3>
            <div className="afb-chart-card">
              <DistributionChart
                data={agg.successStories}
                labels={SUCCESS_STORY_LABELS}
                color="var(--admin-green)"
              />
            </div>
            {agg.successStoryTexts.length > 0 && (
              <div className="afb-stories-list">
                {agg.successStoryTexts.map((s, i) => (
                  <div key={i} className="afb-story-card">
                    <p className="afb-story-text">"{s.text}"</p>
                    <div className="afb-story-meta">
                      <span className="afb-story-date">
                        {new Date(s.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                      </span>
                      {s.allowPublish && <span className="afb-publish-badge">✅ מאשר/ת פרסום</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Improvement Suggestions Count ─── */}
          {agg.improvementCount > 0 && (
            <div className="afb-improvement-banner">
              💡 {agg.improvementCount} משתתפים כתבו הצעות לשיפור (ניתן לראות בתשובות הבודדות למטה)
            </div>
          )}

          {/* ─── All Responses ─── */}
          <div className="ea-section">
            <h3 className="ea-section__title">📋 כל התשובות ({total})</h3>
            <div className="afb-responses-list">
              {data.responses.map((r, i) => (
                <ResponseCard key={r.id} response={r} index={i} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
