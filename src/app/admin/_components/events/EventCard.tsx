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
  onUpdateStatus: (id: string, status: string) => void;
  onToggleQrSent: (id: string, sent: boolean) => void;
  onTogglePayment: (id: string, status: 'unpaid' | 'paid' | 'waived') => void;
  onDelete: (id: string) => void;
}

const statusBadgeClass = (status: string): string => ({
  active: 'admin-badge--active',
  draft: 'admin-badge--draft',
  paused: 'admin-badge--paused',
  ended: 'admin-badge--ended',
  archived: 'admin-badge--archived',
}[status] || 'admin-badge--draft');

const shortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

export default function EventRow({
  event, onViewDetails, onGenerateQR, onCopyUrl,
  onUploadBg, onRemoveBg, onUpdateStatus, onToggleQrSent, onTogglePayment, onDelete,
}: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const isArchived = event.status === 'archived';
  const typeIcon = EVENT_TYPE_ICONS[event.event_type] || '?';

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedH = 340;
    let top = rect.bottom + 4;
    if (top + estimatedH > window.innerHeight) top = Math.max(8, rect.top - estimatedH - 4);
    let left = rect.left;
    if (left + 220 > window.innerWidth) left = Math.max(8, window.innerWidth - 220 - 8);
    setMenuPos({ top, left });
  }, []);

  useEffect(() => {
    if (!menuOpen || !menuRef.current || !menuPos) return;
    const mRect = menuRef.current.getBoundingClientRect();
    if (mRect.bottom > window.innerHeight - 8) {
      const bRect = btnRef.current?.getBoundingClientRect();
      if (bRect) setMenuPos(prev => prev ? { ...prev, top: Math.max(8, bRect.top - mRect.height - 4) } : prev);
    }
  }, [menuOpen, menuPos]);

  useEffect(() => {
    if (!menuOpen) return;
    updatePosition();
    const onClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', () => setMenuOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen, updatePosition]);

  const act = (fn: () => void) => { setMenuOpen(false); fn(); };

  return (
    <div
      className={`ev-row ev-row--${event.status}`}
      onClick={() => onViewDetails(event)}
      tabIndex={0}
      role="button"
      aria-label={`פרטי אירוע ${event.name}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetails(event); } }}
    >
      {/* Type icon */}
      <div className="ev-row__type" aria-hidden="true">{typeIcon}</div>

      {/* Info */}
      <div className="ev-row__info">
        <div className="ev-row__name">
          {event.name}
          <span
            className={`ev-row__pip ${event.payment_status === 'paid' ? 'ev-row__pip--ok' : event.payment_status === 'waived' ? 'ev-row__pip--info' : 'ev-row__pip--warn'}`}
            title={event.payment_status === 'paid' ? 'שולם' : event.payment_status === 'waived' ? 'הנחה' : 'לא שולם'}
          >
            {event.payment_status === 'paid' ? 'V' : event.payment_status === 'waived' ? 'G' : '?'} 
          </span>
          {event.wa_messages_enabled && (
            <span
              className={`ev-row__pip ${event.guest_list_uploaded ? 'ev-row__pip--ok' : 'ev-row__pip--warn'}`}
              title={event.guest_list_uploaded ? `הודעות פעיל - ${event.guest_list_count} מספרים` : 'ממתין להעלאת רשימה'}
            >
              WA {event.guest_list_uploaded ? (event.guest_list_count ?? '') : '!'}
            </span>
          )}
          <span
            className={`ev-row__pip ${event.qr_page_sent ? 'ev-row__pip--ok' : 'ev-row__pip--warn'}`}
            title={event.qr_page_sent ? 'QR נשלח' : 'QR טרם נשלח'}
          >
            {event.qr_page_sent ? 'V' : '?'} QR
          </span>
        </div>
        <div className="ev-row__meta">
          <span className="ev-row__slug">/{event.slug}</span>
          <span className="ev-row__date">{shortDate(event.starts_at)} - {shortDate(event.ends_at)}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="ev-row__right" onClick={e => e.stopPropagation()}>
        <span className={`admin-badge ${statusBadgeClass(event.status)}`}>
          {EVENT_STATUS_LABELS[event.status] || event.status}
        </span>

        <button
          ref={btnRef}
          className="ev-menu-btn"
          onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          aria-label="תפריט פעולות"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ...
        </button>

        {menuOpen && menuPos && createPortal(
          <div
            ref={menuRef}
            className="ev-dropdown"
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
          >
            <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onViewDetails(event))}>
              פרטים ואנליטיקס
            </button>

            {!isArchived && (
              <>
                <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onGenerateQR(event))}>
                  QR קוד
                </button>
                <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onCopyUrl(event))}>
                  העתק קישור
                </button>
                <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onUploadBg(event.id))}>
                  העלה רקע
                </button>
                {event.background_image && (
                  <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onRemoveBg(event.id))}>
                    הסר רקע
                  </button>
                )}
                <button
                  className="ev-dropdown__item"
                  role="menuitem"
                  onClick={() => act(() => onToggleQrSent(event.id, !event.qr_page_sent))}
                >
                  {event.qr_page_sent ? 'סמן QR כלא נשלח' : 'סמן QR כנשלח'}
                </button>

                <div className="ev-dropdown__divider" />

                {event.payment_status !== 'paid' && (
                  <button className="ev-dropdown__item ev-dropdown__item--success" role="menuitem" onClick={() => act(() => onTogglePayment(event.id, 'paid'))}>
                    סמן כשולם
                  </button>
                )}
                {event.payment_status !== 'waived' && (
                  <button className="ev-dropdown__item" role="menuitem" onClick={() => act(() => onTogglePayment(event.id, 'waived'))}>
                    סמן כהנחה/ביטול
                  </button>
                )}
                {event.payment_status !== 'unpaid' && (
                  <button className="ev-dropdown__item ev-dropdown__item--warning" role="menuitem" onClick={() => act(() => onTogglePayment(event.id, 'unpaid'))}>
                    סמן כלא שולם
                  </button>
                )}

                <div className="ev-dropdown__divider" />

                {event.status === 'active' ? (
                  <button className="ev-dropdown__item ev-dropdown__item--warning" role="menuitem" onClick={() => act(() => onUpdateStatus(event.id, 'paused'))}>
                    השהה
                  </button>
                ) : (event.status === 'paused' || event.status === 'draft') ? (
                  <button className="ev-dropdown__item ev-dropdown__item--success" role="menuitem" onClick={() => act(() => onUpdateStatus(event.id, 'active'))}>
                    הפעל
                  </button>
                ) : null}
              </>
            )}

            <div className="ev-dropdown__divider" />
            <button className="ev-dropdown__item ev-dropdown__item--danger" role="menuitem" onClick={() => act(() => onDelete(event.id))}>
              מחק
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}