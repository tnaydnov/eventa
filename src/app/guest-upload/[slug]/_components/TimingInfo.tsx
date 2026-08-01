import { formatSendTime, formatDeadline } from '../formatters';

interface TimingInfoProps {
  startsAt: string;
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
