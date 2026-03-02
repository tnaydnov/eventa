'use client';

import { useRef, useState, useCallback } from 'react';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  templateUrl: string;
  disabled?: boolean;
}

const ACCEPTED = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const ACCEPTED_EXT = ['.xlsx', '.csv'];

export default function UploadZone({ onUpload, templateUrl, disabled }: UploadZoneProps) {
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
        return;
      }
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, uploading, handleFile]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !uploading) setDragover(true);
    },
    [disabled, uploading]
  );

  const onDragLeave = useCallback(() => setDragover(false), []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const zoneClasses = [
    'portal-upload-zone',
    dragover && 'portal-upload-zone--dragover',
    disabled && 'portal-upload-zone--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="portal-section">
      <h2 className="portal-section-title">📤 העלאת רשימת אורחים</h2>

      {/* Step-by-step guide */}
      <div className="portal-steps">
        <div className="portal-step">
          <span className="portal-step-num">1</span>
          <div className="portal-step-content">
            <span className="portal-step-label">הורידו את הקובץ לדוגמה</span>
            <span className="portal-step-desc">קובץ Excel מוכן עם הכותרות הנכונות</span>
          </div>
        </div>
        <div className="portal-step">
          <span className="portal-step-num">2</span>
          <div className="portal-step-content">
            <span className="portal-step-label">מלאו את מספרי הטלפון</span>
            <span className="portal-step-desc">הוסיפו מספרים ישראליים בתוך הקובץ</span>
          </div>
        </div>
        <div className="portal-step">
          <span className="portal-step-num">3</span>
          <div className="portal-step-content">
            <span className="portal-step-label">העלו את הקובץ כאן</span>
            <span className="portal-step-desc">גררו לכאן או לחצו לבחירה</span>
          </div>
        </div>
      </div>

      {/* Template download */}
      <a
        href={templateUrl}
        download
        className="portal-template-btn"
        tabIndex={0}
      >
        📥 הורידו את הטמפלט
      </a>

      {/* "How should it look?" toggle */}
      <button
        type="button"
        className="portal-guide-toggle"
        onClick={() => setShowGuide((v) => !v)}
        aria-expanded={showGuide}
      >
        {showGuide ? '▲' : '▼'} איך הקובץ צריך להיראות?
      </button>

      {showGuide && (
        <div className="portal-guide">
          {/* Mini spreadsheet preview */}
          <div className="portal-spreadsheet">
            <div className="portal-spreadsheet-row portal-spreadsheet-header">
              <span>טלפון</span>
              <span>שם (אופציונלי)</span>
            </div>
            <div className="portal-spreadsheet-row">
              <span dir="ltr">0501234567</span>
              <span>דנה כהן</span>
            </div>
            <div className="portal-spreadsheet-row">
              <span dir="ltr">052-1234567</span>
              <span>יוסי לוי</span>
            </div>
            <div className="portal-spreadsheet-row">
              <span dir="ltr">054-1234567</span>
              <span></span>
            </div>
          </div>

          <div className="portal-guide-notes">
            <p>✅ אפשר עם מקף או בלי: <span dir="ltr" className="portal-mono">052-1234567</span> או <span dir="ltr" className="portal-mono">0521234567</span></p>
            <p>✅ עמודת השם היא אופציונלית — אפשר להשאיר ריק</p>
            <p>✅ רק מספרים ישראליים שמתחילים ב-<span dir="ltr" className="portal-mono">05</span></p>
            <p>✅ עד 500 מספרים בקובץ אחד (אפשר להעלות עוד)</p>
            <p>✅ מספרים כפולים יסוננו אוטומטית</p>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={zoneClasses}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="גררו קובץ לכאן או לחצו לבחירת קובץ"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled && !uploading) inputRef.current?.click();
          }
        }}
      >
        {uploading ? (
          <div className="portal-upload-progress">
            <span className="portal-upload-icon">⏳</span>
            <p className="portal-upload-text">מעלה את הקובץ…</p>
            <div className="portal-upload-progress-bar">
              <div
                className="portal-upload-progress-fill"
                style={{ '--progress': 0.6 } as React.CSSProperties}
              />
            </div>
          </div>
        ) : (
          <>
            <span className="portal-upload-icon">📁</span>
            <p className="portal-upload-text">גררו קובץ לכאן</p>
            <p className="portal-upload-hint">
              או לחצו לבחירת קובץ &middot; Excel / CSV &middot; עד 500 שורות
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={onFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}
