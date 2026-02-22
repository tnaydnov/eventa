'use client';

import type { WizardFormState } from '../wizard-config';
import { WIZARD_TYPE_MAP } from '../wizard-config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepMessages({ state, onChange }: Props) {
  const typeConfig = WIZARD_TYPE_MAP[state.eventType];
  const supported = typeConfig?.supportsGuestMessages !== false;

  if (!supported) {
    // Auto-skip: this step shouldn't show for unsupported types.
    // The wizard orchestrator handles skipping; this is a fallback.
    return null;
  }

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הודעות לאורחים</h2>
        <p className="wiz-step__subtitle">
          רוצים שנשלח הודעה לאורחים ביום האירוע עם קישור להצטרפות?
        </p>
      </div>

      <div className="wiz-toggle-group">
        <button
          type="button"
          className={`wiz-toggle${!state.wantsGuestMessages ? ' wiz-toggle--active' : ''}`}
          onClick={() => onChange({ wantsGuestMessages: false })}
        >
          <span className="wiz-toggle__icon"><WizardIcon name="x-circle" size={22} /></span>
          <div className="wiz-toggle__content">
            <p className="wiz-toggle__title">לא, תודה</p>
            <p className="wiz-toggle__desc">אסתפק ב-QR בכניסה לאירוע</p>
          </div>
          <span className="wiz-toggle__switch" />
        </button>

        <button
          type="button"
          className={`wiz-toggle${state.wantsGuestMessages ? ' wiz-toggle--active' : ''}`}
          onClick={() => onChange({ wantsGuestMessages: true })}
        >
          <span className="wiz-toggle__icon"><WizardIcon name="chat" size={22} /></span>
          <div className="wiz-toggle__content">
            <p className="wiz-toggle__title">כן, שלחו הודעות</p>
            <p className="wiz-toggle__desc">SMS / WhatsApp לאורחים ביום האירוע</p>
          </div>
          <span className="wiz-toggle__switch" />
        </button>
      </div>

      {/* Info box when messages enabled */}
      {state.wantsGuestMessages && (
        <div className="wiz-msg-info">
          <p className="wiz-msg-info__title">איך זה עובד?</p>
          <p className="wiz-msg-info__text">
            לקראת האירוע נשלח לכם קישור להעלאת רשימת מספרי טלפון (קובץ Excel).
            ביום האירוע, כל אורח יקבל הודעה עם קישור אישי להצטרפות - בלי צורך לסרוק QR.
          </p>
        </div>
      )}
    </div>
  );
}
