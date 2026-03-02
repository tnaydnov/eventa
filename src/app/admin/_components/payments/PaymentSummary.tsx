'use client';

import {
  PAYMENT_STATUS_DISPLAY,
  PAYMENT_METHOD_LABELS,
  formatILS,
  type PaymentSummaryData,
} from '../shared';

interface PaymentSummaryProps {
  data: PaymentSummaryData | null;
  loading: boolean;
}

export default function PaymentSummary({ data, loading }: PaymentSummaryProps) {
  if (loading || !data) {
    return (
      <div className="pay-summary">
        <div className="pay-summary__grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="pay-summary__card pay-summary__card--loading">
              <div className="pay-summary__skeleton pay-summary__skeleton--label" />
              <div className="pay-summary__skeleton pay-summary__skeleton--value" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const paidCount = data.statusCounts.paid || 0;
  const pendingCount = (data.statusCounts.pending_payment || 0) + (data.statusCounts.payment_link_sent || 0);
  const waivedCount = data.statusCounts.waived || 0;

  const cards = [
    {
      emoji: '💰',
      label: 'הכנסות מאושרות',
      value: formatILS(data.totalRevenue),
      sub: `${paidCount} תשלומים`,
      color: 'pay-summary__card--green',
    },
    {
      emoji: '⏳',
      label: 'ממתינים לתשלום',
      value: formatILS(data.pendingRevenue),
      sub: `${pendingCount} בקשות`,
      color: 'pay-summary__card--orange',
    },
    {
      emoji: '🧾',
      label: 'חשבוניות שהופקו',
      value: String(data.invoiceCount),
      sub: data.invoice4uConfigured ? 'Invoice4U מחובר' : 'Invoice4U לא מוגדר',
      color: data.invoice4uConfigured ? 'pay-summary__card--blue' : 'pay-summary__card--muted',
    },
    {
      emoji: '🎁',
      label: 'ויתורים / הנחות',
      value: String(waivedCount),
      sub: `מתוך ${data.totalRequests} בקשות`,
      color: 'pay-summary__card--purple',
    },
  ];

  return (
    <div className="pay-summary">
      {/* Main stats grid */}
      <div className="pay-summary__grid">
        {cards.map(c => (
          <div key={c.label} className={`pay-summary__card ${c.color}`}>
            <div className="pay-summary__card-header">
              <span className="pay-summary__card-emoji">{c.emoji}</span>
              <span className="pay-summary__card-label">{c.label}</span>
            </div>
            <div className="pay-summary__card-value">{c.value}</div>
            <div className="pay-summary__card-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Payment method breakdown */}
      {Object.keys(data.methodCounts).length > 0 && (
        <div className="pay-summary__breakdown">
          <div className="pay-summary__breakdown-title">פילוח לפי אמצעי תשלום</div>
          <div className="pay-summary__breakdown-chips">
            {Object.entries(data.methodCounts).map(([method, count]) => (
              <div key={method} className="pay-summary__chip">
                <span className="pay-summary__chip-label">
                  {PAYMENT_METHOD_LABELS[method] || method}
                </span>
                <span className="pay-summary__chip-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown (compact) */}
      <div className="pay-summary__breakdown">
        <div className="pay-summary__breakdown-title">פילוח לפי סטטוס</div>
        <div className="pay-summary__breakdown-chips">
          {Object.entries(data.statusCounts).map(([status, count]) => {
            const display = PAYMENT_STATUS_DISPLAY[status];
            if (!display || count === 0) return null;
            return (
              <div key={status} className="pay-summary__chip">
                <span className="pay-summary__chip-label">
                  {display.emoji} {display.label}
                </span>
                <span className="pay-summary__chip-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
