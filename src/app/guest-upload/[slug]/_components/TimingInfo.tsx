'use client';

interface TimingInfoProps {
  startsAt: string;
}

const hebrewFormat: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
};

function formatSendTime(startsAt: string): string {
  const eventDate = new Date(startsAt);
  // Messages sent 3 hours before event
  const sendTime = new Date(eventDate.getTime() - 3 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('he-IL', hebrewFormat).format(sendTime);
}

function formatDeadline(startsAt: string): string {
  const eventDate = new Date(startsAt);
  // Deadline = 2 hours before send time = 5 hours before event
  const deadline = new Date(eventDate.getTime() - 5 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('he-IL', hebrewFormat).format(deadline);
}

export default function TimingInfo({ startsAt }: TimingInfoProps) {
  const sendTimeStr = formatSendTime(startsAt);
  const deadlineStr = formatDeadline(startsAt);

  return (
    <div className="portal-section">
      <h2 className="portal-section-title">📅 לוח זמנים</h2>
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
            <span className="portal-timing-sub">2 שעות לפני שליחת ההודעות</span>
          </div>
        </div>
      </div>
    </div>
  );
}
