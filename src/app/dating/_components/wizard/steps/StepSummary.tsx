'use client';

import type { WizardFormState } from '../wizard-config';
import { WIZARD_TYPE_MAP } from '../wizard-config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
  onGoToStep: (step: number) => void;
}

/** Format datetime-local value to readable Hebrew string. */
function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StepSummary({ state, onChange, onGoToStep }: Props) {
  const typeConfig = WIZARD_TYPE_MAP[state.eventType];

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">סיכום ההזמנה</h2>
        <p className="wiz-step__subtitle">בדקו שהכל נכון, השלימו פרטי קשר ושלחו.</p>
      </div>

      {/* Summary cards */}
      <div className="wiz-summary">
        <div className="wiz-summary__card">
          <div className="wiz-summary__card-content">
            <div className="wiz-summary__card-label">סוג אירוע</div>
            <div className="wiz-summary__card-value">
              {typeConfig && <WizardIcon name={typeConfig.icon} size={16} className="wiz-summary__inline-icon" />} {typeConfig?.label}
            </div>
          </div>
          <button type="button" className="wiz-summary__card-edit" onClick={() => onGoToStep(0)}>
            שנה
          </button>
        </div>

        <div className="wiz-summary__card">
          <div className="wiz-summary__card-content">
            <div className="wiz-summary__card-label">
              {state.eventName ? 'שם האירוע' : 'תאריך'}
            </div>
            <div className="wiz-summary__card-value">
              {state.eventName && <>{state.eventName} · </>}
              {formatDateTime(state.startsAt)}
            </div>
          </div>
          <button type="button" className="wiz-summary__card-edit" onClick={() => onGoToStep(1)}>
            שנה
          </button>
        </div>

        <div className="wiz-summary__card">
          <div className="wiz-summary__card-content">
            <div className="wiz-summary__card-label">רקע</div>
            <div className="wiz-summary__card-value">
              {state.wantsCustomBackground
                ? <><WizardIcon name="paperclip" size={14} className="wiz-summary__inline-icon" /> רקע מותאם אישית</>
                : <><WizardIcon name="moon" size={14} className="wiz-summary__inline-icon" /> ברירת מחדל</>
              }
            </div>
          </div>
          <button type="button" className="wiz-summary__card-edit" onClick={() => onGoToStep(2)}>
            שנה
          </button>
        </div>

        <div className="wiz-summary__card">
          <div className="wiz-summary__card-content">
            <div className="wiz-summary__card-label">פוסטר</div>
            <div className="wiz-summary__card-value">
              {state.posterChoice === 'qr-only'
                ? <><WizardIcon name="qr" size={14} className="wiz-summary__inline-icon" /> QR בלבד</>
                : <><WizardIcon name="image" size={14} className="wiz-summary__inline-icon" /> תבנית: {state.selectedTemplateId ?? ''}</>
              }
              {state.specialRequests && ' + בקשות מיוחדות'}
            </div>
          </div>
          <button type="button" className="wiz-summary__card-edit" onClick={() => onGoToStep(3)}>
            שנה
          </button>
        </div>

        <div className="wiz-summary__card">
          <div className="wiz-summary__card-content">
            <div className="wiz-summary__card-label">הודעות לאורחים</div>
            <div className="wiz-summary__card-value">
              {state.wantsGuestMessages
                ? <><WizardIcon name="chat" size={14} className="wiz-summary__inline-icon" /> כן, שלחו הודעות</>
                : <><WizardIcon name="x-circle" size={14} className="wiz-summary__inline-icon" /> לא</>
              }
            </div>
          </div>
          <button type="button" className="wiz-summary__card-edit" onClick={() => onGoToStep(4)}>
            שנה
          </button>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="wiz-price">
        <div className="wiz-price__row">
          <span>חבילת אירוע בסיסית</span>
          <span>₪250</span>
        </div>
        {state.wantsGuestMessages && (
          <div className="wiz-price__row">
            <span>הודעות לאורחים (SMS / WhatsApp)</span>
            <span>₪50</span>
          </div>
        )}
        <div className="wiz-price__divider" />
        <div className="wiz-price__row wiz-price__row--total">
          <span>סה״כ</span>
          <span>₪{250 + (state.wantsGuestMessages ? 50 : 0)}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0' }} />

      {/* Contact preference */}
      <div className="wiz-field" style={{ marginBottom: 16 }}>
        <label className="wiz-field__label">איך נמשיך?</label>
      </div>

      <div className="wiz-contact-options">
        <button
          type="button"
          className={`wiz-contact-opt${state.contactPreference === 'call-me' ? ' wiz-contact-opt--selected' : ''}`}
          onClick={() => onChange({ contactPreference: 'call-me' })}
        >
          <div className="wiz-contact-opt__icon"><WizardIcon name="phone" size={22} /></div>
          <div className="wiz-contact-opt__label">צרו איתי קשר</div>
          <div className="wiz-contact-opt__desc">נחזור אליכם תוך 48 שעות</div>
        </button>

        <button
          type="button"
          className={`wiz-contact-opt${state.contactPreference === 'send-link' ? ' wiz-contact-opt--selected' : ''}`}
          onClick={() => onChange({ contactPreference: 'send-link' })}
        >
          <div className="wiz-contact-opt__icon"><WizardIcon name="link" size={22} /></div>
          <div className="wiz-contact-opt__label">שלחו לי לינק</div>
          <div className="wiz-contact-opt__desc">לינק לתשלום ישירות</div>
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0' }} />

      {/* Contact fields */}
      <div className="wiz-fields">
        <div className="wiz-field">
          <label className="wiz-field__label">שם מלא *</label>
          <input
            className="wiz-field__input"
            type="text"
            placeholder="השם שלכם"
            value={state.contactName}
            onChange={e => onChange({ contactName: e.target.value })}
            maxLength={100}
            required
          />
        </div>

        <div className="wiz-field__row">
          <div className="wiz-field">
            <label className="wiz-field__label">טלפון *</label>
            <input
              className="wiz-field__input"
              type="tel"
              placeholder="050-0000000"
              value={state.contactPhone}
              onChange={e => onChange({ contactPhone: e.target.value })}
              maxLength={30}
              dir="ltr"
              required
            />
          </div>

          <div className="wiz-field">
            <label className="wiz-field__label">אימייל</label>
            <input
              className="wiz-field__input"
              type="email"
              placeholder="mail@example.com"
              value={state.contactEmail}
              onChange={e => onChange({ contactEmail: e.target.value })}
              maxLength={254}
              dir="ltr"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
