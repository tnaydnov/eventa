'use client';

import { useRef, useCallback } from 'react';
import type { WizardFormState } from '../wizard-config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

/** Max background image size (5 MB). */
const MAX_BG_SIZE = 5 * 1024 * 1024;

export default function StepBackground({ state, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_BG_SIZE) {
        alert('הקובץ גדול מדי. מקסימום 5MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('יש להעלות קובץ תמונה בלבד.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onChange({
          wantsCustomBackground: true,
          backgroundPreview: base64,
          backgroundBase64: base64,
        });
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearImage = useCallback(() => {
    onChange({
      wantsCustomBackground: false,
      backgroundPreview: null,
      backgroundBase64: null,
    });
    if (fileRef.current) fileRef.current.value = '';
  }, [onChange]);

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">רקע לאפליקציה</h2>
        <p className="wiz-step__subtitle">
          הוסיפו תמונת רקע מותאמת שתופיע מאחורי ממשק ההיכרויות באירוע, או השאירו את ברירת המחדל.
        </p>
      </div>

      <div className="wiz-toggle-group">
        {/* Default option */}
        <button
          type="button"
          className={`wiz-toggle${!state.wantsCustomBackground ? ' wiz-toggle--active' : ''}`}
          onClick={clearImage}
        >
          <span className="wiz-toggle__icon"><WizardIcon name="moon" size={22} /></span>
          <div className="wiz-toggle__content">
            <p className="wiz-toggle__title">רקע ברירת מחדל</p>
            <p className="wiz-toggle__desc">רקע כהה אלגנטי - מושלם לכל אירוע</p>
          </div>
          <span className="wiz-toggle__switch" />
        </button>

        {/* Custom option */}
        <button
          type="button"
          className={`wiz-toggle${state.wantsCustomBackground ? ' wiz-toggle--active' : ''}`}
          onClick={() => {
            if (!state.wantsCustomBackground) {
              onChange({ wantsCustomBackground: true });
            }
          }}
        >
          <span className="wiz-toggle__icon"><WizardIcon name="brush" size={22} /></span>
          <div className="wiz-toggle__content">
            <p className="wiz-toggle__title">רקע מותאם אישית</p>
            <p className="wiz-toggle__desc">העלו תמונה משלכם</p>
          </div>
          <span className="wiz-toggle__switch" />
        </button>
      </div>

      {/* Upload zone - only when custom is selected */}
      {state.wantsCustomBackground && !state.backgroundPreview && (
        <div
          className="wiz-upload"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') fileRef.current?.click(); }}
        >
          <div className="wiz-upload__icon"><WizardIcon name="upload" size={36} /></div>
          <p className="wiz-upload__text">גררו תמונה לכאן או לחצו לבחירה</p>
          <p className="wiz-upload__hint">JPG, PNG, WebP - עד 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {/* Preview */}
      {state.backgroundPreview && (
        <div className="wiz-upload__preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.backgroundPreview} alt="תצוגה מקדימה" />
          <button
            type="button"
            className="wiz-upload__remove"
            onClick={clearImage}
            aria-label="הסר תמונה"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
