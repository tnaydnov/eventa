'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  onToggleQrSent: (id: string, sent: boolean) => void;
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
  onUploadBg, onRemoveBg, onRotate, onUpdateStatus, onToggleQrSent, onDelete,
}: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const typeIcon = EVENT_TYPE_ICONS[event.event_type] || '📌';
  const statusLabel = EVENT_STATUS_LABELS[event.status] || event.status;
  const isArchived = event.status === 'archived';

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Default: open below the button
    let top = rect.bottom + 4;
    const left = rect.left;
    // If the menu would overflow the viewport bottom, open above instead
    // Estimate menu height (~320px) - will be corrected after mount
    const estimatedHeight = 320;
    if (top + estimatedHeight > window.innerHeight) {
      top = rect.top - estimatedHeight - 4;
      if (top < 8) top = 8; // don't go above viewport
    }
    setMenuPos({ top, left });
  }, []);

  // After the dropdown renders, adjust position if it overflows
  useEffect(() => {
    if (!menuOpen || !menuRef.current || !menuPos) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    if (menuRect.bottom > viewportH - 8) {
      // Flip above the button
      const btnRect = btnRef.current?.getBoundingClientRect();
      if (btnRect) {
        const newTop = btnRect.top - menuRect.height - 4;
        setMenuPos(prev => prev ? { ...prev, top: Math.max(8, newTop) } : prev);
      }
    }
  }, [menuOpen, menuPos]);

  useEffect(() => {
    if (!menuOpen) return;
    updatePosition();
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen, updatePosition]);

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
        <div className="et-name">
          {event.name}
          {event.wa_messages_enabled && (
            <span className={`et-msg-badge ${event.guest_list_uploaded ? 'et-msg-badge--ok' : 'et-msg-badge--pending'}`}
              title={event.guest_list_uploaded ? `📱 הודעות - ${event.guest_list_count} מספרים` : '📱 הודעות - ממתין להעלאת רשימה'}
            >
              📱 {event.guest_list_uploaded ? event.guest_list_count : '!'}
            </span>
          )}
          <span
            className={`et-msg-badge ${event.qr_page_sent ? 'et-msg-badge--ok' : 'et-msg-badge--pending'}`}
            title={event.qr_page_sent ? 'דף QR נשלח ✅' : 'דף QR טרם נשלח'}
          >
            {event.qr_page_sent ? '✅' : '⏳'} QR
          </span>
        </div>
        <div className="et-slug">/{event.slug}</div>
      </td>
      <td className="et-td">
        <span className={`admin-badge ${statusBadgeClass(event.status)}`}>
          {statusLabel}
        </span>
      </td>
      <td className="et-td et-td--date et-td--hide-mobile">
        {shortDate(event.starts_at)} - {shortDate(event.ends_at)}
      </td>
      <td className="et-td et-td--actions" onClick={e => e.stopPropagation()}>
        <div className="et-actions-wrap">
          <button className="et-menu-btn" ref={btnRef} onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
          {menuOpen && menuPos && createPortal(
            <div className="et-dropdown" ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}>
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
                  <button
                    className="et-dropdown__item"
                    onClick={() => act(() => onToggleQrSent(event.id, !event.qr_page_sent))}
                  >
                    {event.qr_page_sent ? '↩ סמן QR כלא נשלח' : '✅ סמן QR כנשלח'}
                  </button>
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
            </div>,
            document.body
          )}
        </div>
      </td>
    </tr>
  );
}
