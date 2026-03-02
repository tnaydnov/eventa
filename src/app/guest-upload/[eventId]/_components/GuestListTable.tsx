'use client';

import { useState, useCallback } from 'react';
import type { PortalGuest } from '@/lib/api/guest-portal';

interface GuestListTableProps {
  guests: PortalGuest[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRemove: (phoneId: string) => Promise<void>;
  isReadOnly: boolean;
}

export default function GuestListTable({
  guests,
  total,
  page,
  totalPages,
  onPageChange,
  onRemove,
  isReadOnly,
}: GuestListTableProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = useCallback(
    async (phoneId: string) => {
      setRemovingId(phoneId);
      try {
        await onRemove(phoneId);
      } finally {
        setRemovingId(null);
      }
    },
    [onRemove]
  );

  if (total === 0) {
    return (
      <div className="portal-section">
        <h2 className="portal-section-title">📋 רשימת אורחים</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
          טרם הועלו מספרים. העלו קובץ או הוסיפו מספרים בודדים.
        </p>
      </div>
    );
  }

  return (
    <div className="portal-section">
      <div className="portal-list-header">
        <h2 className="portal-section-title" style={{ margin: 0 }}>
          📋 רשימת אורחים
        </h2>
        <span className="portal-list-count">{total} אורחים</span>
      </div>

      <div className="portal-guest-table">
        {guests.map((guest) => (
          <div key={guest.id} className="portal-guest-row">
            <span className="portal-guest-name">
              {guest.name || '—'}
            </span>
            <span className="portal-guest-phone">{guest.maskedPhone}</span>
            <span
              className={`portal-guest-status ${
                guest.sent
                  ? 'portal-guest-status--sent'
                  : 'portal-guest-status--pending'
              }`}
            >
              {guest.sent ? 'נשלח ✓' : 'ממתין'}
            </span>
            {!isReadOnly && (
              <button
                className="portal-guest-remove"
                onClick={() => handleRemove(guest.id)}
                disabled={guest.sent || removingId === guest.id}
                title={guest.sent ? 'לא ניתן להסיר — כבר נשלחה הודעה' : 'הסרה'}
              >
                {removingId === guest.id ? '…' : '🗑'}
              </button>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="portal-pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ◄ הקודם
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            הבא ►
          </button>
        </div>
      )}
    </div>
  );
}
