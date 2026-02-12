'use client';

import { useState, useRef, useEffect } from 'react';
import type { Event } from '@/lib/database.types';
import { EVENT_TYPE_ICONS, EVENT_STATUS_LABELS } from '@/lib/constants';

interface EventRowProps {
  event: Event;
  onViewDetails: (event: Event) => void;
  onGenerateQR: (event: Event) => void;
  onCopyUrl: (event: Event) => void;
  onUploadBg: (eventId: string) => void;
  onRemoveBg: (eventId: string) => void;
  onRotate: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

const statusBadgeClass = (status: string): string => {
  const map: Record<string, string> = {
    active: 'admin-badge--active',
    draft: 'admin-badge--draft',
    paused: 'admin-badge--paused',
    ended: 'admin-badge--ended',
    archived: 'admin-badge--archived',
  };
  return map[status] || 'admin-badge--draft';
};

const shortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

export default function EventRow({
  event, onViewDetails, onGenerateQR, onCopyUrl,
  onUploadBg, onRemoveBg, onRotate, onUpdateStatus, onDelete,
}: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const typeIcon = EVENT_TYPE_ICONS[event.event_type] || '📌';
  const statusLabel = EVENT_STATUS_LABELS[event.status] || event.status;
  const isArchived = event.status === 'archived';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const act = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <tr className="et-row" onClick={() => onViewDetails(event)}>
      <td className="et-td">
        <span className="et-type-icon">{typeIcon}</span>
      </td>
      <td className="et-td et-td--name">
        <div className="et-name">{event.name}</div>
        <div className="et-slug">/{event.slug}</div>
      </td>
      <td className="et-td">
        <span className={`admin-badge ${statusBadgeClass(event.status)}`}>
          {statusLabel}
        </span>
      </td>
      <td className="et-td et-td--date et-td--hide-mobile">
        {shortDate(event.starts_at)} — {shortDate(event.ends_at)}
      </td>
      <td className="et-td et-td--actions" onClick={e => e.stopPropagation()}>
        <div className="et-actions-wrap" ref={menuRef}>
          <button className="et-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
          {menuOpen && (
            <div className="et-dropdown">
              <button className="et-dropdown__item" onClick={() => act(() => onViewDetails(event))}>
                📊 פרטים ואנליטיקס
              </button>
              {!isArchived && (
                <>
                  <button className="et-dropdown__item" onClick={() => act(() => onGenerateQR(event))}>
                    📱 QR קוד
                  </button>
                  <button className="et-dropdown__item" onClick={() => act(() => onCopyUrl(event))}>
                    📋 העתק קישור
                  </button>
                  <button className="et-dropdown__item" onClick={() => act(() => onRotate(event.id))}>
                    🔄 החלף קוד כניסה
                  </button>
                  <button className="et-dropdown__item" onClick={() => act(() => onUploadBg(event.id))}>
                    🖼 העלה רקע
                  </button>
                  {event.background_image && (
                    <button className="et-dropdown__item" onClick={() => act(() => onRemoveBg(event.id))}>
                      ✖ הסר רקע
                    </button>
                  )}
                  <div className="et-dropdown__divider" />
                  {event.status === 'active' ? (
                    <button className="et-dropdown__item et-dropdown__item--warning" onClick={() => act(() => onUpdateStatus(event.id, 'paused'))}>
                      ⏸ השהה
                    </button>
                  ) : (event.status === 'paused' || event.status === 'draft') ? (
                    <button className="et-dropdown__item et-dropdown__item--success" onClick={() => act(() => onUpdateStatus(event.id, 'active'))}>
                      ▶ הפעל
                    </button>
                  ) : null}
                </>
              )}
              <div className="et-dropdown__divider" />
              <button className="et-dropdown__item et-dropdown__item--danger" onClick={() => act(() => onDelete(event.id))}>
                🗑 מחק
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
