'use client';

import { useState, useEffect } from 'react';
import type { WizardFormState, PosterTemplate } from '../wizard-config';
import { getTemplatesForType } from '../wizard-config';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepPoster({ state, onChange }: Props) {
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Load poster manifest
  useEffect(() => {
    fetch('/templates/manifest.json')
      .then(r => r.json())
      .then(data => {
        const filtered = getTemplatesForType(data.templates || [], state.eventType);
        setTemplates(filtered);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [state.eventType]);

  const selectTemplate = (id: string) => {
    onChange({ posterChoice: 'template', selectedTemplateId: id });
  };

  const selectQrOnly = () => {
    onChange({ posterChoice: 'qr-only', selectedTemplateId: null });
  };

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">פוסטר כניסה</h2>
        <p className="wiz-step__subtitle">
          בחרו עיצוב לפוסטר ה-QR שיעמוד בכניסה לאירוע, או השאירו QR בלבד.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          טוען תבניות...
        </div>
      ) : (
        <div className="wiz-posters">
          {/* QR-only option */}
          <button
            type="button"
            className={`wiz-poster wiz-poster--qr${state.posterChoice === 'qr-only' ? ' wiz-poster--selected' : ''}`}
            onClick={selectQrOnly}
          >
            <span className="wiz-poster__check" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wiz-poster__qr-icon">📲</span>
            <span className="wiz-poster__qr-text">QR בלבד<br />בלי פוסטר</span>
          </button>

          {/* Template options */}
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              className={`wiz-poster${state.selectedTemplateId === t.id ? ' wiz-poster--selected' : ''}`}
              onClick={() => selectTemplate(t.id)}
            >
              <span className="wiz-poster__check" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="wiz-poster__img"
                src={`/templates/${t.file}`}
                alt={t.label}
                loading="lazy"
              />
              <span className="wiz-poster__label">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Special requests */}
      <div className="wiz-field" style={{ marginTop: 24 }}>
        <label className="wiz-field__label">בקשות מיוחדות לפוסטר</label>
        <span className="wiz-field__hint">שינויי טקסט, צבעים, לוגו אישי - נשמח להתאים</span>
        <textarea
          className="wiz-field__textarea"
          placeholder="לדוגמה: אנא הוסיפו את הלוגו שלנו בפינה..."
          value={state.specialRequests}
          onChange={e => onChange({ specialRequests: e.target.value })}
          maxLength={500}
        />
      </div>
    </div>
  );
}
