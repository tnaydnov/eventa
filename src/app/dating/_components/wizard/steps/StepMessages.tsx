'use client';

import type { WizardFormState } from '../wizard-config';
import { MSG_ADDON } from '@/lib/config';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepMessages({ state, onChange }: Props) {
  const enabled = state.wantsGuestMessages;

  return (
    <div className="wiz-step">
      {/* ── Heading ── */}
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">יותר רווקים ורווקות באפליקציה</h2>
        <p className="wiz-step__subtitle">
          שלחו הודעת WhatsApp לאורחים לפני האירוע
          <br />
          ותנו להם להצטרף לאפליקציה מהבית.
        </p>
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
    </div>
  );
}
