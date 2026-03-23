'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { WizardFormState, PosterTemplate } from '../wizard-config';
import { getTemplatesForType } from '../wizard-config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepPoster({ state, onChange }: Props) {
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');

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

  const openPreview = (src: string, label: string) => {
    setPreviewSrc(src);
    setPreviewLabel(label);
  };

  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewLabel('');
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!previewSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewSrc, closePreview]);

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
            aria-pressed={state.posterChoice === 'qr-only'}
            className={`wiz-poster wiz-poster--qr${state.posterChoice === 'qr-only' ? ' wiz-poster--selected' : ''}`}
            onClick={selectQrOnly}
          >
            <span className="wiz-poster__check" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wiz-poster__qr-icon"><WizardIcon name="qr" size={30} /></span>
            <span className="wiz-poster__qr-text">QR בלבד<br />בלי פוסטר</span>
          </button>

          {/* Template options */}
          {templates.map(t => {
            const imgSrc = `/templates/${t.file}`;
            return (
              <div key={t.id} className="wiz-poster-wrap">
                <button
                  type="button"
                  aria-pressed={state.selectedTemplateId === t.id}
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
                    src={imgSrc}
                    alt={t.label}
                    loading="lazy"
                  />
                  <span className="wiz-poster__label">{t.label}</span>
                </button>
                <button
                  type="button"
                  className="wiz-poster__zoom"
                  aria-label={`הגדל תבנית ${t.label}`}
                  onClick={() => openPreview(imgSrc, t.label)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6" /><path d="M8 11h6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Template disclaimer */}
      <div className="wiz-poster-note">
        <svg className="wiz-poster-note__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        <div>
          <p className="wiz-poster-note__text">
            <strong>התבניות מוצגות כדוגמה בלבד</strong> - קוד ה-QR המעודכן ישולב בפוסטר הסופי, שיישלח אליכם כחלק מהסדר.
          </p>
          <p className="wiz-poster-note__text">
            בנוסף, תקבלו בנפרד את קוד ה-QR עצמו וגם את הקישור (URL) לצורך שיתוף דיגיטלי.
          </p>
        </div>
      </div>

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

      {/* Full-screen preview modal - portaled to body to bypass parent transforms */}
      {previewSrc && createPortal(
        <div className="wiz-poster-modal" role="dialog" aria-modal="true" aria-label={`תצוגה מקדימה: ${previewLabel}`} onClick={closePreview}>
          <button type="button" className="wiz-poster-modal__close" onClick={closePreview} aria-label="סגור תצוגה מקדימה">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
          <div className="wiz-poster-modal__body" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt={previewLabel} className="wiz-poster-modal__img" />
            <span className="wiz-poster-modal__label">{previewLabel}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
