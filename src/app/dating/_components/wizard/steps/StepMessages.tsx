'use client';

import WizardIcon from '../WizardIcons';

export default function StepMessages() {
  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הודעות לאורחים</h2>
        <p className="wiz-step__subtitle">
          שליחת הודעות WhatsApp לאורחים עם קישור אישי להצטרפות.
        </p>
      </div>

      {/* Coming soon notice */}
      <div className="wiz-coming-soon">
        <div className="wiz-coming-soon__badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          בקרוב
        </div>
        <p className="wiz-coming-soon__text">
          שירות הודעות WhatsApp לאורחים נמצא בפיתוח ויהיה זמין בקרוב.
        </p>
        <div className="wiz-coming-soon__features">
          <p className="wiz-coming-soon__features-title">מה יכלול השירות:</p>
          <ul>
            <li><WizardIcon name="chat" size={14} /> שליחת הודעות WhatsApp לאורחים עם קישור אישי</li>
            <li><WizardIcon name="check" size={14} /> העלאת רשימת טלפונים מקובץ Excel</li>
            <li><WizardIcon name="check" size={14} /> הצטרפות ללא צורך בסריקת QR</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
