'use client';

import type { WizardFormState, WizardTypeConfig } from '../wizard-config';
import { WIZARD_TYPES } from '../wizard-config';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepEventType({ state, onChange }: Props) {
  const select = (t: WizardTypeConfig) => onChange({ eventType: t.key });

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">באיזה אירוע מדובר?</h2>
        <p className="wiz-step__subtitle">בחרו את סוג האירוע שלכם - זה ישפיע על התבניות וההתאמות.</p>
      </div>

      <div className="wiz-types">
        {WIZARD_TYPES.map(t => (
          <button
            key={t.key}
            type="button"
            className={`wiz-type-card${state.eventType === t.key ? ' wiz-type-card--selected' : ''}`}
            onClick={() => select(t)}
            aria-pressed={state.eventType === t.key}
          >
            <span className="wiz-type-card__check" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wiz-type-card__icon">{t.icon}</span>
            <span className="wiz-type-card__label">{t.label}</span>
            <span className="wiz-type-card__desc">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
