'use client';

import type { WizardFormState } from '../wizard-config';
import { WIZARD_TYPE_MAP } from '../wizard-config';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepEventDetails({ state, onChange }: Props) {
  const typeConfig = WIZARD_TYPE_MAP[state.eventType];
  const nameField = typeConfig?.nameField;

  // Minimum selectable datetime = now (rounded down to current minute)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const minDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">פרטי האירוע</h2>
        <p className="wiz-step__subtitle">ספרו לנו מתי ואיך קוראים לאירוע.</p>
      </div>

      <div className="wiz-fields">
        {/* Event Name - dynamic per type */}
        {nameField && (
          <div className="wiz-field">
            <label className="wiz-field__label">
              {nameField.label}
              {nameField.required && ' *'}
            </label>
            {nameField.hint && (
              <span className="wiz-field__hint">{nameField.hint}</span>
            )}
            <input
              className="wiz-field__input"
              type="text"
              dir={state.eventType === 'wedding' ? 'ltr' : 'rtl'}
              placeholder={nameField.placeholder}
              value={state.eventName}
              onChange={e => onChange({ eventName: e.target.value })}
              maxLength={100}
            />
          </div>
        )}

        {/* Date & Time */}
        <div className="wiz-field">
          <label className="wiz-field__label">תאריך ושעת התחלה *</label>
          <input
            className="wiz-field__input"
            type="datetime-local"
            value={state.startsAt}
            min={minDateTime}
            onChange={e => {
              const start = e.target.value;
              onChange({ startsAt: start });

              // Auto-set end time if empty
              if (start && !state.endsAt && typeConfig) {
                const startDate = new Date(start);
                startDate.setHours(startDate.getHours() + typeConfig.defaultDurationHours);
                const end = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
                onChange({ startsAt: start, endsAt: end });
              }
            }}
          />
        </div>

        <div className="wiz-field">
          <label className="wiz-field__label">תאריך ושעת סיום *</label>
          <input
            className="wiz-field__input"
            type="datetime-local"
            value={state.endsAt}
            onChange={e => onChange({ endsAt: e.target.value })}
            min={state.startsAt || undefined}
          />
        </div>
      </div>
    </div>
  );
}
