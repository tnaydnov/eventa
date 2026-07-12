'use client';

import { useState, useRef, useCallback } from 'react';
import type { WizardFormState } from '../wizard-config';
import WizardIcon from '../WizardIcons';
import BackgroundPreview from './BackgroundPreview';
import ImageCropper from '@/components/ImageCropper';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

/** Max background image size (5 MB). */
const MAX_BG_SIZE = 5 * 1024 * 1024;

export default function StepBackground({ state, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('background.jpg');
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileError(null);
      if (file.size > MAX_BG_SIZE) {
        setFileError('הקובץ גדול מדי. מקסימום 5MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setFileError('יש להעלות קובץ תמונה בלבד.');
        return;
      }

      // Open the cropper instead of auto-cropping
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(reader.result as string);
        setCropFileName(file.name);
      };
      reader.readAsDataURL(file);
    },
    []
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
          aria-pressed={!state.wantsCustomBackground}
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
          aria-pressed={state.wantsCustomBackground}
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

      {/* Upload zone – only when custom selected and no image yet */}
      {state.wantsCustomBackground && !state.backgroundPreview && (
        <div
          className="wiz-upload"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        >
          <div className="wiz-upload__icon"><WizardIcon name="upload" size={36} /></div>
          <p className="wiz-upload__text">גררו תמונה לכאן או לחצו לבחירה</p>
          <p className="wiz-upload__hint">JPG, PNG, WebP - עד 5MB</p>
          {fileError && <p className="wiz-upload__error" role="alert">{fileError}</p>}
        </div>
      )}

      {/* Hidden file input – always available when custom bg is active (replace too) */}
      {state.wantsCustomBackground && (
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // reset so the same file can be re-selected
            e.target.value = '';
          }}
        />
      )}

      {/* Image Cropper */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={9 / 16}
          cropShape="rect"
          fileName={cropFileName}
          onCropDone={(croppedFile) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              onChange({
                wantsCustomBackground: true,
                backgroundPreview: base64,
                backgroundBase64: base64,
              });
            };
            reader.readAsDataURL(croppedFile);
            setCropSrc(null);
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Phone mockup preview */}
      <BackgroundPreview
        backgroundPreview={state.backgroundPreview ?? null}
        wantsCustomBackground={!!state.wantsCustomBackground}
        eventName={state.eventName}
      />

      {/* Replace / remove actions – shown only after an image is uploaded */}
      {state.wantsCustomBackground && state.backgroundPreview && (
        <div className="wiz-bg-actions">
          {fileError && <p className="wiz-upload__error" role="alert" style={{ textAlign: 'center', marginBottom: 8 }}>{fileError}</p>}
          <button
            type="button"
            className="wiz-bg-actions__btn wiz-bg-actions__btn--replace"
            onClick={() => fileRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M4 4v5h5" />
              <path d="M16 16v-5h-5" />
              <path d="M4 9a8 8 0 0114 3" />
              <path d="M16 11a8 8 0 01-14-3" />
            </svg>
            החלף תמונה
          </button>
          <button
            type="button"
            className="wiz-bg-actions__btn wiz-bg-actions__btn--remove"
            onClick={clearImage}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
            הסר תמונה
          </button>
        </div>
      )}
    </div>
  );
}
