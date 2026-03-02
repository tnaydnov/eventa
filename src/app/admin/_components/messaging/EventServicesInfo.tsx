'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch, type EventRequest } from '../shared';

interface EventServicesInfoProps {
  eventId: string;
}

interface ServiceData {
  wantsGuestMessages: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactPreference: string | null;
}

const CONTACT_PREF_LABELS: Record<string, string> = {
  whatsapp: '📱 WhatsApp',
  phone: '📞 טלפון',
  email: '📧 אימייל',
};

export default function EventServicesInfo({ eventId }: EventServicesInfoProps) {
  const [data, setData] = useState<ServiceData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch event request data to get contact info + messaging selection
      const res = await adminFetch('/api/admin/requests');
      if (res.ok) {
        const { requests } = await res.json() as { requests: EventRequest[] };
        const req = requests.find((r) => r.approved_event_id === eventId);
        if (req) {
          setData({
            wantsGuestMessages: req.wants_guest_messages,
            contactName: req.contact_name,
            contactPhone: req.contact_phone,
            contactEmail: req.contact_email,
            contactPreference: req.contact_preference,
          });
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="ea-section">
        <h3 className="ea-section__title">💰 שירותים ומחיר</h3>
        <div className="admin-skeleton" style={{ height: 80 }} />
      </div>
    );
  }

  if (!data) return null;

  const basePrice = 250;
  const messagingPrice = 50;
  const total = basePrice + (data.wantsGuestMessages ? messagingPrice : 0);

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
              {data.wantsGuestMessages ? `₪${messagingPrice} ✅` : '❌ לא נרכש'}
            </span>
          </div>
          <div className="msg-status-item">
            <span className="msg-status-label">סה״כ</span>
            <span className="msg-status-value" style={{ fontWeight: 700 }}>₪{total}</span>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="ea-section">
        <h3 className="ea-section__title">📞 פרטי התקשרות</h3>
        <div className="msg-status-grid">
          {data.contactName && (
            <div className="msg-status-item">
              <span className="msg-status-label">שם</span>
              <span className="msg-status-value">{data.contactName}</span>
            </div>
          )}
          {data.contactPhone && (
            <div className="msg-status-item">
              <span className="msg-status-label">טלפון</span>
              <span className="msg-status-value" dir="ltr">{data.contactPhone}</span>
            </div>
          )}
          {data.contactEmail && (
            <div className="msg-status-item">
              <span className="msg-status-label">אימייל</span>
              <span className="msg-status-value" dir="ltr" style={{ fontSize: '0.8em' }}>{data.contactEmail}</span>
            </div>
          )}
          {data.contactPreference && (
            <div className="msg-status-item">
              <span className="msg-status-label">העדפת תקשורת</span>
              <span className="msg-status-value">{CONTACT_PREF_LABELS[data.contactPreference] || data.contactPreference}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
