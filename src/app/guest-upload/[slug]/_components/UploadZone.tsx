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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
        return; // silently ignore — parent will show toast if needed
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

      {/* Template download */}
      <a
        href={templateUrl}
        download
        className="portal-template-btn"
        tabIndex={0}
      >
        📥 הורידו את הטמפלט
      </a>

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
