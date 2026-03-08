'use client';

import { useState } from 'react';
import type { WizardFormState } from '../wizard-config';
import { MSG_ADDON } from '@/lib/config';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepMessages({ state, onChange }: Props) {
  const enabled = state.wantsGuestMessages;
  const [previewOpen, setPreviewOpen] = useState(true);
  const eventName = state.eventName || 'האירוע שלכם';

  return (
    <div className="wiz-step">
      {/* ── Hero heading ── */}
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הגדילו את מספר הרווקים והרווקות באפליקציה</h2>
        <p className="wiz-step__subtitle">
          שלחו הודעת WhatsApp לאורחים לפני האירוע
          <br />
          ותנו להם להצטרף לאפליקציה בנוחות מהבית.
        </p>
      </div>

      {/* ── Step 1: Message preview (create mental image) ── */}
      <div className="wiz-msg-preview-section">
        <p className="wiz-msg-preview-intro">
          כך האורחים שלכם יוזמנו להצטרף לאפליקציה
          <br />
          לפני שהאירוע מתחיל
        </p>

        <button
          type="button"
          className={`wiz-msg-preview-toggle ${previewOpen ? 'wiz-msg-preview-toggle--open' : ''}`}
          onClick={() => setPreviewOpen((v) => !v)}
          aria-expanded={previewOpen}
        >
          <span>👀 איך ההודעה נראית?</span>
          <span className="wiz-msg-preview-chevron">{previewOpen ? '▲' : '▼'}</span>
        </button>

        {previewOpen && (
          <div className="wiz-msg-wa-frame">
            <div className="wiz-msg-wa-header">
              <div className="wiz-msg-wa-avatar">E</div>
              <div className="wiz-msg-wa-name">Eventa</div>
            </div>
            <div className="wiz-msg-wa-chat">
              <div className="wiz-msg-wa-bubble">
                <p>מגיעים ל{eventName}? את/ה רווק/ה? 💍</p>
                <p>הם מצאו את אהבתם, עכשיו תורכם! ❤️</p>
                <p style={{ marginTop: 4 }}>
                  באירוע תהיה לכם הזדמנות להצטרף לאפליקציית <strong>Eventa</strong> - ולראות את שאר הרווקים והרווקות שיהיו שם.
                </p>
                <p style={{ marginTop: 4 }}>
                  אל תדאגו - זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒
                </p>
                <p style={{ marginTop: 4 }}>
                  כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח…{'\n'}אולי תשיגו משהו מעניין 😏
                </p>
                <p className="wiz-msg-wa-link">🔗 קישור להצטרפות לאירוע</p>
              </div>
            </div>
            <p className="wiz-msg-wa-note">* התוכן המדויק עשוי להשתנות מעט</p>
          </div>
        )}
      </div>

      {/* ── Step 2: Why it matters ── */}
      <div className="wiz-msg-tip">
        <div className="wiz-msg-tip__icon">💡</div>
        <div className="wiz-msg-tip__text">
          <strong>למה זה חשוב?</strong>
          {' '}מהניסיון שלנו, חלק גדול מהאורחים לא סורקים QR במהלך האירוע.
          <br /><br />
          כאשר האורחים מקבלים הודעה מראש,
          יש להם זמן להצטרף לאפליקציה בנוחות מהבית —
          וכך הרבה יותר רווקים ורווקות כבר נמצאים פעילים בזמן האירוע.
        </div>
      </div>

      {/* ── Step 3: Strong stat ── */}
      <div className="wiz-msg-stat">
        <span className="wiz-msg-stat__icon">📈</span>
        <p className="wiz-msg-stat__text">
          אירועים ששולחים הודעה מראש מקבלים
          <strong> פי 3 יותר רווקים ורווקות באפליקציה</strong>
        </p>
      </div>

      <div className="wiz-msg-stat wiz-msg-stat--secondary">
        <p className="wiz-msg-stat__text">
          באירועים ששולחים הודעה מראש
          <br />
          בממוצע <strong>60-80 אורחים</strong> מצטרפים לאפליקציה עוד לפני האירוע.
        </p>
      </div>

      {/* ── Feature cards ── */}
      <div className="wiz-msg-features wiz-msg-features--active">
        <div className="wiz-msg-features__grid">
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">📱</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת WhatsApp לפני האירוע</strong>
              <span>כל אורח מקבל הודעה עם קישור ישיר להצטרפות לאפליקציה.</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">🏠</div>
            <div className="wiz-msg-feature__text">
              <strong>הצטרפות נוחה מהבית</strong>
              <span>האורחים יכולים להירשם בזמן שלהם, בלי צורך לסרוק QR במהלך האירוע.</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">💑</div>
            <div className="wiz-msg-feature__text">
              <strong>יותר רווקים ורווקות באפליקציה</strong>
              <span>כאשר האורחים מצטרפים מראש, יותר אנשים כבר נמצאים פעילים בזמן האירוע.</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">💬</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת תודה אחרי האירוע</strong>
              <span>יום אחרי האירוע נשלחת הודעה עם קישור למשוב קצר על החוויה.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── NOW the toggle decision ── */}
      <div className="wiz-msg-social-proof">
        ⭐ רוב האירועים מוסיפים את השדרוג הזה
      </div>

      <button
        type="button"
        className={`wiz-msg-toggle ${enabled ? 'wiz-msg-toggle--active' : ''}`}
        onClick={() => onChange({ wantsGuestMessages: !enabled })}
      >
        <div className="wiz-msg-toggle__header">
          <div className={`wiz-msg-toggle__switch ${enabled ? 'wiz-msg-toggle__switch--on' : ''}`}>
            <div className="wiz-msg-toggle__switch-thumb" />
          </div>
          <div className="wiz-msg-toggle__content">
            <div className="wiz-msg-toggle__title">
              שליחת הודעות WhatsApp לאורחים לפני האירוע
            </div>
            <div className="wiz-msg-toggle__price">+₪{MSG_ADDON}</div>
          </div>
        </div>
      </button>

      <p className="wiz-msg-toggle-hint">
        ניתן להסיר את השדרוג בכל רגע לפני התשלום.
      </p>

      {/* How it works */}
      <div className="wiz-msg-howto">
        <div className="wiz-msg-howto__title">⚙️ איך זה עובד?</div>
        <ol className="wiz-msg-howto__steps">
          <li>לאחר הרכישה תקבלו קישור למערכת העלאת מספרים</li>
          <li>תעלו קובץ Excel עם רשימת הטלפונים (נשלח לכם תבנית מוכנה)</li>
          <li>כ-3 שעות לפני האירוע - נשלח הודעות WhatsApp אוטומטית</li>
          <li>יום אחרי האירוע - נשלח הודעת פידבק עם קישור למשוב קצר</li>
        </ol>
      </div>
    </div>
  );
}
