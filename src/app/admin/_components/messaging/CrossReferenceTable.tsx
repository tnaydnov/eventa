'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '../shared';

interface CrossReferenceData {
  guestListCount: number;
  joinedCount: number;
  qrJoinCount: number;
  totalParticipants: number;
}

interface CrossReferenceTableProps {
  eventId: string;
}

export default function CrossReferenceTable({ eventId }: CrossReferenceTableProps) {
  const [data, setData] = useState<CrossReferenceData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Combine stats from messaging status + participants
      const [msgRes, statsRes] = await Promise.all([
        adminFetch(`/api/admin/events/${eventId}/messaging`),
        adminFetch(`/api/admin/events/${eventId}/stats`),
      ]);
      if (msgRes.ok && statsRes.ok) {
        const msg = await msgRes.json();
        const stats = await statsRes.json();
        setData({
          guestListCount: msg.totalGuestPhones ?? 0,
          joinedCount: msg.preEventSentCount ?? 0, // approximation: sent = invited
          qrJoinCount: Math.max(0, (stats.participants ?? 0) - (msg.preEventSentCount ?? 0)),
          totalParticipants: stats.participants ?? 0,
        });
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
        <h3 className="ea-section__title">🔗 הצלבת נתונים</h3>
        <div className="admin-skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  if (!data) return null;

  const joinRate = data.guestListCount > 0
    ? Math.round((data.joinedCount / data.guestListCount) * 100)
    : 0;

  return (
    <div className="ea-section">
      <h3 className="ea-section__title">🔗 הצלבת נתונים: רשימה ← משתתפים</h3>
      <div className="msg-status-grid">
        <div className="msg-status-item">
          <span className="msg-status-label">רשימת אורחים</span>
          <span className="msg-status-value">{data.guestListCount}</span>
        </div>
        <div className="msg-status-item">
          <span className="msg-status-label">הצטרפו מ-SMS</span>
          <span className="msg-status-value">{data.joinedCount}</span>
        </div>
        <div className="msg-status-item">
          <span className="msg-status-label">הצטרפו מ-QR</span>
          <span className="msg-status-value">{data.qrJoinCount}</span>
        </div>
        <div className="msg-status-item">
          <span className="msg-status-label">סה״כ משתתפים</span>
          <span className="msg-status-value">{data.totalParticipants}</span>
        </div>
      </div>

      {/* Funnel bar */}
      <div className="msg-funnel">
        <div className="msg-funnel-bar">
          <div
            className="msg-funnel-fill"
            style={{ width: `${Math.min(joinRate, 100)}%` }}
          />
        </div>
        <span className="msg-funnel-label">
          {joinRate}% מהרשימה הצטרפו לאירוע
        </span>
      </div>
    </div>
  );
}
