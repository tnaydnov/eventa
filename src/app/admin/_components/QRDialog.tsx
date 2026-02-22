'use client';

import type { Event } from '@/lib/database.types';

interface QRDialogProps {
  event: Event;
  dataUrl: string;
  onClose: () => void;
  onDownload: () => void;
  onCopyUrl: (event: Event) => void;
}

export default function QRDialog({ event, dataUrl, onClose, onDownload, onCopyUrl }: QRDialogProps) {
  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-dialog" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <h3 className="admin-dialog__title" style={{ color: 'var(--admin-accent)' }}>
          📱 QR - {event.name}
        </h3>
        <p className="admin-text-muted" style={{ marginBottom: '16px' }}>
          שיתפו את ה-QR הזה כדי לאפשר לאורחים להצטרף
        </p>

        {dataUrl && (
          <div style={{ background: 'var(--admin-bg)', padding: '20px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px', maxWidth: '100%' }}>
            <img src={dataUrl} alt="QR Code" className="qr-dialog__img" />
          </div>
        )}

        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', wordBreak: 'break-all', marginBottom: '16px' }}>
          {typeof window !== 'undefined' && window.location.origin}/dating/{event.slug}?k={event.join_code}
        </p>

        <div className="admin-dialog__actions" style={{ justifyContent: 'center' }}>
          <button onClick={onDownload} className="admin-btn admin-btn--primary">📥 הורד QR</button>
          <button onClick={() => onCopyUrl(event)} className="admin-btn admin-btn--sm admin-btn--blue">📋 העתק קישור</button>
          <button onClick={onClose} className="admin-btn admin-btn--ghost">סגור</button>
        </div>
      </div>
    </div>
  );
}
