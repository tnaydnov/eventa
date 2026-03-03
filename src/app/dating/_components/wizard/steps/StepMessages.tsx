'use client';

import { useState } from 'react';
import type { WizardFormState } from '../wizard-config';
import { MSG_ADDON } from '@/lib/config';
import WizardIcon from '../WizardIcons';

interface Props {
  state: WizardFormState;
  onChange: (patch: Partial<WizardFormState>) => void;
}

export default function StepMessages({ state, onChange }: Props) {
  const enabled = state.wantsGuestMessages;
  const [previewOpen, setPreviewOpen] = useState(false);
  const eventName = state.eventName || 'האירוע שלכם';

  return (
    <div className="wiz-step">
      <div className="wiz-step__header">
        <h2 className="wiz-step__title">הודעות WhatsApp לאורחים</h2>
        <p className="wiz-step__subtitle">
          שלחו לאורחים הודעת WhatsApp עם קישור אישי לאפליקציה - בלי צורך ב-QR.
        </p>
      </div>

      {/* Toggle card */}
      <button
        type="button"
        className={`wiz-msg-toggle ${enabled ? 'wiz-msg-toggle--active' : ''}`}
        onClick={() => onChange({ wantsGuestMessages: !enabled })}
      >
        <div className="wiz-msg-toggle__header">
          <div className="wiz-msg-toggle__icon">
            <WizardIcon name="chat" size={24} />
          </div>
          <div className="wiz-msg-toggle__content">
            <div className="wiz-msg-toggle__title">שירות הודעות לאורחים</div>
            <div className="wiz-msg-toggle__price">+₪{MSG_ADDON}</div>
          </div>
          <div className={`wiz-msg-toggle__switch ${enabled ? 'wiz-msg-toggle__switch--on' : ''}`}>
            <div className="wiz-msg-toggle__switch-thumb" />
          </div>
        </div>
      </button>

      {/* Feature list */}
      <div className={`wiz-msg-features ${enabled ? 'wiz-msg-features--active' : ''}`}>
        <div className="wiz-msg-features__grid">
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">📱</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת WhatsApp לפני האירוע</strong>
              <span>כל אורח מקבל קישור אישי להצטרפות - בלי סריקת QR</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">📊</div>
            <div className="wiz-msg-feature__text">
              <strong>העלאת רשימת טלפונים</strong>
              <span>תקבלו קישור ייעודי להעלאת מספרי טלפון מ-Excel</span>
            </div>
          </div>
          <div className="wiz-msg-feature">
            <div className="wiz-msg-feature__icon">💬</div>
            <div className="wiz-msg-feature__text">
              <strong>הודעת פידבק יום אחרי</strong>
              <span>נשלח לאורחים הודעה עם קישור למשוב קצר על החוויה</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tip: Why choose this */}
      {enabled && (
        <div className="wiz-msg-tip">
          <div className="wiz-msg-tip__icon">💡</div>
          <div className="wiz-msg-tip__text">
            <strong>למה כדאי?</strong> מהניסיון שלנו, חלק מהאורחים מפספסים את השלטים באירוע
            או מתביישים לסרוק QR מול אנשים. שליחת הודעה מראש נותנת להם זמן להיכנס, להירשם,
            להסתכל מי יהיה שם... וככה הרבה יותר אורחים מצטרפים בפועל.
          </div>
        </div>
      )}

      {/* WA Message Preview */}
      {enabled && (
        <div className="wiz-msg-preview-section">
          <button
            type="button"
            className="wiz-msg-preview-toggle"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
          >
            <span>{previewOpen ? '▲' : '▼'} 👀 איך ההודעה נראית?</span>
          </button>

          {previewOpen && (
            <div className="wiz-msg-wa-frame">
              {/* Mini WA header */}
              <div className="wiz-msg-wa-header">
                <div className="wiz-msg-wa-avatar">E</div>
                <div className="wiz-msg-wa-name">Eventa</div>
              </div>
              {/* Chat bubble */}
              <div className="wiz-msg-wa-chat">
                <div className="wiz-msg-wa-bubble">
                  <p>מגיעים ל{eventName}? את/ה רווק/ה? 💍</p>
                  <p>הם מצאו את אהבתם, עכשיו תורכם! ❤️</p>
                  <p style={{ marginTop: 4 }}>
                    באירוע תהיה לכם הזדמנות להצטרף לאפליקציית <strong>Eventa</strong> - ולראות את שאר הרווקים והרווקות שיהיו שם.
                  </p>
                  <p style={{ marginTop: 4 }}>
                    אל תדאגו - זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒
                  </p>
                  <p style={{ marginTop: 4 }}>
                    כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח…{'\n'}אולי תשיגו משהו מעניין 😏
                  </p>
                  <p className="wiz-msg-wa-link">🔗 קישור להצטרפות לאירוע</p>
                </div>
              </div>
              <p className="wiz-msg-wa-note">* התוכן המדויק עשוי להשתנות מעט</p>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="wiz-msg-howto">
        <div className="wiz-msg-howto__title">
          <WizardIcon name="check" size={14} /> איך זה עובד?
        </div>
        <ol className="wiz-msg-howto__steps">
          <li>לאחר הרכישה תקבלו קישור למערכת העלאת מספרים</li>
          <li>תעלו קובץ Excel עם רשימת הטלפונים (נשלח לכם תבנית מוכנה)</li>
          <li>כ-3 שעות לפני האירוע - נשלח הודעות WhatsApp אוטומטית</li>
          <li>יום אחרי האירוע - נשלח הודעת פידבק עם קישור למשוב קצר</li>
        </ol>
      </div>
    </div>
  );
}
