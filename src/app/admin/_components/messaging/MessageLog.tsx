'use client';

import type { MessageLogEntry } from '../shared';

interface MessageLogProps {
  entries: MessageLogEntry[];
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: '📱 WhatsApp (ישן)',
  sms: '📲 SMS',
  email: '📧 Email',
};

const TYPE_LABELS: Record<string, string> = {
  pre_event: 'Pre-Event',
  feedback: 'פידבק',
  reminder: 'תזכורת',
  custom: 'חופשי',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ממתין', cls: 'admin-badge--draft' },
  sent: { label: 'נשלח', cls: 'admin-badge--active' },
  delivered: { label: 'נמסר', cls: 'admin-badge--active' },
  failed: { label: 'נכשל', cls: 'admin-badge--ended' },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function MessageLog({ entries }: MessageLogProps) {
  if (entries.length === 0) {
    return (
      <div className="ea-section">
        <h3 className="ea-section__title">📃 לוג הודעות</h3>
        <p className="msg-empty">אין הודעות בלוג.</p>
      </div>
    );
  }

  return (
    <div className="ea-section">
      <h3 className="ea-section__title">📃 לוג הודעות ({entries.length})</h3>
      <div className="msg-table-wrap">
        <table className="msg-table">
          <thead>
            <tr>
              <th scope="col">זמן</th>
              <th scope="col">סוג</th>
              <th scope="col">ערוץ</th>
              <th scope="col">סטטוס</th>
              <th scope="col">שגיאה</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const st = STATUS_LABELS[entry.status] || { label: entry.status, cls: '' };
              return (
                <tr key={entry.id}>
                  <td>{formatTime(entry.sentAt)}</td>
                  <td>{TYPE_LABELS[entry.messageType] || entry.messageType}</td>
                  <td>{CHANNEL_LABELS[entry.channel] || entry.channel}</td>
                  <td>
                    <span className={`admin-badge admin-badge--sm ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="msg-error-cell">
                    {entry.errorMessage || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
