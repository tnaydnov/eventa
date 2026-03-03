'use client';

import type { WizardFormState } from '../wizard-config';
import { MSG_ADDON } from '@/lib/config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepMessages({ state, onChange }: Props) {
  const enabled = state.wantsGuestMessages;

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הודעות WhatsApp לאורחים</h2>
        <p className="wiz-step__subtitle">
          שלחו לאורחים הודעת WhatsApp עם קישור אישי לאפליקציה - בלי צורך ב-QR.
        </p>
      </div>

      {/* Toggle card */}
      <button
        type="button"
        className={`wiz-msg-toggle ${enabled ? 'wiz-msg-toggle--active' : ''}`}
        onClick={() => onChange({ wantsGuestMessages: !enabled })}
      >
        <div className="wiz-msg-toggle__header">
          <div className="wiz-msg-toggle__icon">
            <WizardIcon name="chat" size={24} />
          </div>
          <div className="wiz-msg-toggle__content">
            <div className="wiz-msg-toggle__title">שירות הודעות לאורחים</div>
            <div className="wiz-msg-toggle__price">+₪{MSG_ADDON}</div>
          </div>
          <div className={`wiz-msg-toggle__switch ${enabled ? 'wiz-msg-toggle__switch--on' : ''}`}>
            <div className="wiz-msg-toggle__switch-thumb" />
          </div>
        </div>
      </button>

      {/* Feature list */}
      <div className={`wiz-msg-features ${enabled ? 'wiz-msg-features--active' : ''}`}>
        <div className="wiz-msg-features__grid">
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">📱</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת WhatsApp לפני האירוע</strong>
              <span>כל אורח מקבל קישור אישי להצטרפות - בלי סריקת QR</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">📊</div>
            <div className="wiz-msg-feature__text">
              <strong>העלאת רשימת טלפונים</strong>
              <span>תקבלו קישור ייעודי להעלאת מספרי טלפון מ-Excel</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">💬</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת פידבק + הנחה</strong>
              <span>יום אחרי האירוע - סקר קצר וקוד הנחה 10% לאירוע הבא</span>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="wiz-msg-howto">
        <div className="wiz-msg-howto__title">
          <WizardIcon name="check" size={14} /> איך זה עובד?
        </div>
        <ol className="wiz-msg-howto__steps">
          <li>לאחר הרכישה תקבלו קישור למערכת העלאת מספרים</li>
          <li>תעלו קובץ Excel עם רשימת הטלפונים (נשלח לכם תבנית מוכנה)</li>
          <li>כ-3 שעות לפני האירוע - נשלח הודעות WhatsApp אוטומטית</li>
          <li>יום אחרי האירוע - נשלח פידבק + הנחה (למי שהסכים)</li>
        </ol>
      </div>
    </div>
  );
}
