'use client';

import { useState } from 'react';
import type { WizardFormState } from '../wizard-config';

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
      {/* ── Heading ── */}
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">יותר רווקים ורווקות באפליקציה</h2>
        <p className="wiz-step__subtitle">
          שלחו הודעה לאורחים לפני האירוע
          <br />
          ותנו להם להצטרף לאפליקציה מהבית.
        </p>
      </div>

      {/* ── Message preview ── */}
      <div className="wiz-msg-preview-section">
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
                <p>מגיע/ה ל{eventName}? את/ה רווק/ה? 💍</p>
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
                <p style={{ marginTop: 4 }}>נתראה באירוע! 🎉</p>
              </div>
            </div>
            <p className="wiz-msg-wa-note">* התוכן המדויק עשוי להשתנות מעט</p>
          </div>
        )}
      </div>

      {/* ── Strong stat ── */}
      <div className="wiz-msg-stat">
        <span className="wiz-msg-stat__icon">📈</span>
        <p className="wiz-msg-stat__text">
          אירועים ששולחים הודעה מראש
          <br />
          מקבלים <strong>פי 3 יותר רווקים ורווקות באפליקציה</strong>
        </p>
      </div>

      {/* ── 3 short benefits ── */}
      <ul className="wiz-msg-benefits">
        <li>✔ האורחים מצטרפים לאפליקציה עוד לפני האירוע</li>
        <li>✔ אין צורך לסרוק QR בזמן האירוע</li>
        <li>✔ יותר רווקים ורווקות פעילים בזמן אמת</li>
      </ul>

      {/* ── Toggle ── */}
      <div className="wiz-msg-social-proof">
        ⭐ רוב האירועים מוסיפים את השדרוג הזה
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className={`wiz-msg-toggle ${enabled ? 'wiz-msg-toggle--active' : ''}`}
        onClick={() => onChange({ wantsGuestMessages: !enabled })}
      >
        <div className="wiz-msg-toggle__header">
          <div className={`wiz-msg-toggle__switch ${enabled ? 'wiz-msg-toggle__switch--on' : ''}`}>
            <div className="wiz-msg-toggle__switch-thumb" />
          </div>
          <div className="wiz-msg-toggle__content">
            <div className="wiz-msg-toggle__title">
              שליחת הודעות לאורחים לפני האירוע
            </div>
            <div className="wiz-msg-toggle__price">כלול במחיר</div>
          </div>
        </div>
      </button>

      <p className="wiz-msg-toggle-hint">
        ניתן להסיר את השדרוג בכל רגע לפני התשלום.
      </p>
    </div>
  );
}
