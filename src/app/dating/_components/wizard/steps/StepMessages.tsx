'use client';

import WizardIcon from '../WizardIcons';

export default function StepMessages() {
  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הודעות לאורחים</h2>
        <p className="wiz-step__subtitle">
          שירות זה עדיין לא זמין — ניתן לדלג לשלב הבא.
        </p>
      </div>

      {/* Coming soon — visually locked */}
      <div className="wiz-coming-soon">
        {/* Lock icon */}
        <div className="wiz-coming-soon__lock">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="wiz-coming-soon__badge">
          לא זמין כרגע
        </div>
        <p className="wiz-coming-soon__text">
          שירות שליחת הודעות WhatsApp לאורחים נמצא בפיתוח.<br />
          השירות יהיה זמין בקרוב — אין צורך לעשות דבר כרגע.
        </p>
        <div className="wiz-coming-soon__features">
          <p className="wiz-coming-soon__features-title">מה יכלול השירות בעתיד:</p>
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
