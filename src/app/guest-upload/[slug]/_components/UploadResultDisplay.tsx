'use client';

import type { UploadRowError } from '@/lib/guest-upload';

interface UploadResultDisplayProps {
  added: number;
  duplicates: number;
  invalid: number;
  errors: UploadRowError[];
  totalInList: number;
}

export default function UploadResultDisplay({
  added,
  duplicates,
  invalid,
  errors,
  totalInList,
}: UploadResultDisplayProps) {
  const hasErrors = invalid > 0 || duplicates > 0;
  const variant = added === 0 ? 'error' : hasErrors ? 'mixed' : 'success';

  return (
    <div className={`portal-result portal-result--${variant}`}>
      {added > 0 && (
        <div className="portal-result-line">
          <span>✅</span>
          <span>{added} מספרים הועלו בהצלחה</span>
        </div>
      )}
      {duplicates > 0 && (
        <div className="portal-result-line">
          <span>⚠️</span>
          <span>{duplicates} כפולים (כבר ברשימה)</span>
        </div>
      )}
      {invalid > 0 && (
        <div className="portal-result-line">
          <span>❌</span>
          <span>{invalid} לא תקינים</span>
        </div>
      )}
      <div className="portal-result-line" style={{ marginTop: 8 }}>
        <span>📊</span>
        <span>סה״כ ברשימה: {totalInList} אורחים</span>
      </div>

      {errors.length > 0 && (
        <div className="portal-result-errors">
          <strong>פירוט שגיאות:</strong>
          {errors.slice(0, 10).map((err, i) => (
            <div key={i} className="portal-result-error-item">
              שורה {err.row}: {err.phone || '(ריק)'} - {err.reason}
            </div>
          ))}
          {errors.length > 10 && (
            <div className="portal-result-error-item" style={{ opacity: 0.6 }}>
              ו-{errors.length - 10} שגיאות נוספות…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
