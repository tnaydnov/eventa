'use client';

import { useState } from 'react';

interface MessagePreviewProps {
  eventName: string;
  startsAt: string;
}

function formatDeadline(startsAt: string): string {
  const eventDate = new Date(startsAt);

  // Midnight of event day (00:00)
  const midnight = new Date(eventDate);
  midnight.setHours(0, 0, 0, 0);

  // 3 hours before event
  const threeHoursBefore = new Date(eventDate.getTime() - 3 * 60 * 60 * 1000);

  // Deadline = earlier of midnight or 3h before
  const deadline = midnight < threeHoursBefore ? midnight : threeHoursBefore;

  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(deadline);
}

function formatSendTime(startsAt: string): string {
  const eventDate = new Date(startsAt);
  const sendTime = new Date(eventDate.getTime() - 3 * 60 * 60 * 1000);

  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(sendTime);
}

function formatTime(startsAt: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

export default function MessagePreview({ eventName, startsAt }: MessagePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const sendTimeStr = formatSendTime(startsAt);
  const deadlineStr = formatDeadline(startsAt);
  const timeStr = formatTime(startsAt);

  return (
    <div className="portal-section">
      <h2 className="portal-section-title">💬 ההודעה שהאורחים יקבלו</h2>

      {/* Timing info */}
      <div className="portal-timing-info">
        <div className="portal-timing-row">
          <span className="portal-timing-icon">📨</span>
          <div>
            <span className="portal-timing-label">שליחת ההודעות</span>
            <span className="portal-timing-value">{sendTimeStr}</span>
            <span className="portal-timing-sub">3 שעות לפני תחילת האירוע</span>
          </div>
        </div>
        <div className="portal-timing-row">
          <span className="portal-timing-icon">⏰</span>
          <div>
            <span className="portal-timing-label">מועד אחרון לעדכון הרשימה</span>
            <span className="portal-timing-value">{deadlineStr}</span>
            <span className="portal-timing-sub">לאחר מכן לא ניתן לשנות את הרשימה</span>
          </div>
        </div>
      </div>

      {/* Message preview toggle */}
      <button
        type="button"
        className="portal-guide-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? '▲' : '▼'} תצוגה מקדימה של ההודעה
      </button>

      {expanded && (
        <div className="portal-wa-preview">
          <div className="portal-wa-header">
            <span className="portal-wa-avatar">E</span>
            <span className="portal-wa-name">Eventa</span>
          </div>
          <div className="portal-wa-bubble">
            <p className="portal-wa-text">
              שלום <span className="portal-wa-var">שם האורח/ת</span>! 🎉
            </p>
            <p className="portal-wa-text">
              מחכים לכם היום בשעה {timeStr} באירוע <strong>{eventName}</strong>!
            </p>
            <p className="portal-wa-text">
              הצטרפו לאפליקציית Eventa לחוויה המלאה — הכירו אנשים חדשים, שתפו
              תמונות, ועוד:
            </p>
            <p className="portal-wa-link">🔗 קישור להצטרפות לאירוע</p>
            <span className="portal-wa-time">{timeStr}</span>
          </div>
          <p className="portal-wa-disclaimer">
            * ההודעה נשלחת אוטומטית דרך WhatsApp. התוכן המדויק עשוי להשתנות מעט.
          </p>
        </div>
      )}
    </div>
  );
}
