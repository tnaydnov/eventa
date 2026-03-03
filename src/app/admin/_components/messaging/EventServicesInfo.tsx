'use client';

import { useState, useCallback } from 'react';
import type { Event } from '@/lib/database.types';

interface EventServicesInfoProps {
  event: Event;
  onUpdateDetails?: (updates: {
    client_name?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
    communication_preference?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const CONTACT_PREF_LABELS: Record<string, string> = {
  whatsapp: '📱 WhatsApp',
  phone: '📞 טלפון',
  email: '📧 אימייל',
  'call-me': '🔙 חזרו אליי',
};

export default function EventServicesInfo({ event, onUpdateDetails }: EventServicesInfoProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(event.client_name || '');
  const [editEmail, setEditEmail] = useState(event.client_email || '');
  const [editPhone, setEditPhone] = useState(event.client_phone || '');
  const [editPref, setEditPref] = useState(event.communication_preference || 'email');

  const startEdit = useCallback(() => {
    setEditName(event.client_name || '');
    setEditEmail(event.client_email || '');
    setEditPhone(event.client_phone || '');
    setEditPref(event.communication_preference || 'email');
    setEditing(true);
  }, [event]);

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!onUpdateDetails) return;
    setSaving(true);
    try {
      const result = await onUpdateDetails({
        client_name: editName.trim() || null,
        client_email: editEmail.trim() || null,
        client_phone: editPhone.trim() || null,
        communication_preference: editPref || 'email',
      });
      if (result.ok) {
        setEditing(false);
      } else {
        alert(result.error || 'שגיאה בשמירה');
      }
    } finally {
      setSaving(false);
    }
  };

  const basePrice = 250;
  const messagingPrice = 50;
  const hasWa = event.wa_messages_enabled;
  const total = basePrice + (hasWa ? messagingPrice : 0);

  const hasContact = event.client_name || event.client_email || event.client_phone;

  return (
    <>
      <div className="ea-section">
        <h3 className="ea-section__title">💰 שירותים ומחיר</h3>
        <div className="msg-status-grid">
          <div className="msg-status-item">
            <span className="msg-status-label">אירוע בסיסי</span>
            <span className="msg-status-value">₪{basePrice}</span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">הודעות WhatsApp</span>
            <span className="msg-status-value">
              {hasWa ? `₪${messagingPrice} ✅` : '❌ לא נרכש'}
            </span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">סה״כ</span>
            <span className="msg-status-value" style={{ fontWeight: 700 }}>₪{total}</span>
          </div>
        </div>
      </div>

      {/* Contact info - editable */}
      <div className="ea-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="ea-section__title" style={{ margin: 0 }}>📞 פרטי התקשרות</h3>
          {onUpdateDetails && !editing && (
            <button
              className="admin-btn admin-btn--sm admin-btn--ghost"
              onClick={startEdit}
              type="button"
            >
              ✏️ עריכה
            </button>
          )}
        </div>

        {editing ? (
          <div className="msg-status-grid" style={{ marginTop: 12 }}>
            <div className="msg-status-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <label className="msg-status-label">שם מלא</label>
              <input
                className="admin-input admin-input--sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="שם הלקוח"
                maxLength={100}
              />
            </div>
            <div className="msg-status-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <label className="msg-status-label">אימייל</label>
              <input
                className="admin-input admin-input--sm admin-input--ltr"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="client@example.com"
                maxLength={200}
              />
            </div>
            <div className="msg-status-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <label className="msg-status-label">טלפון</label>
              <input
                className="admin-input admin-input--sm admin-input--ltr"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="050-0000000"
                maxLength={20}
              />
            </div>
            <div className="msg-status-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <label className="msg-status-label">העדפת תקשורת</label>
              <select
                className="admin-input admin-input--sm"
                value={editPref}
                onChange={(e) => setEditPref(e.target.value)}
              >
                <option value="email">📧 אימייל</option>
                <option value="phone">📞 טלפון</option>
                <option value="whatsapp">📱 WhatsApp</option>
                <option value="call-me">🔙 חזרו אליי</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1', justifyContent: 'flex-start', marginTop: 4 }}>
              <button
                className="admin-btn admin-btn--sm admin-btn--primary"
                onClick={saveEdit}
                disabled={saving}
                type="button"
              >
                {saving ? '⏳' : '💾'} שמור
              </button>
              <button
                className="admin-btn admin-btn--sm"
                onClick={cancelEdit}
                disabled={saving}
                type="button"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : hasContact ? (
          <div className="msg-status-grid" style={{ marginTop: 8 }}>
            {event.client_name && (
              <div className="msg-status-item">
                <span className="msg-status-label">שם</span>
                <span className="msg-status-value">{event.client_name}</span>
              </div>
            )}
            {event.client_phone && (
              <div className="msg-status-item">
                <span className="msg-status-label">טלפון</span>
                <span className="msg-status-value" dir="ltr">{event.client_phone}</span>
              </div>
            )}
            {event.client_email && (
              <div className="msg-status-item">
                <span className="msg-status-label">אימייל</span>
                <span className="msg-status-value" dir="ltr" style={{ fontSize: '0.8em' }}>{event.client_email}</span>
              </div>
            )}
            {event.communication_preference && (
              <div className="msg-status-item">
                <span className="msg-status-label">העדפת תקשורת</span>
                <span className="msg-status-value">{CONTACT_PREF_LABELS[event.communication_preference] || event.communication_preference}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, padding: '16px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: 13 }}>
            <p>לא הוזנו פרטי לקוח.</p>
            {onUpdateDetails && (
              <button
                className="admin-btn admin-btn--sm admin-btn--primary"
                onClick={startEdit}
                type="button"
                style={{ marginTop: 8 }}
              >
                ✏️ הוסף פרטי לקוח
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
