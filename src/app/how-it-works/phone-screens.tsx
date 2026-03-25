/* ═══════════════════════════════════════════
   How-It-Works - Phone screen mockups
   Realistic UI that matches the actual
   Eventa app from DemoPhone
   ═══════════════════════════════════════════ */

import type { ReactElement } from 'react';
import type { ScreenKey } from './data';
import { GRID_USERS } from './data';
import { HIcon } from './icons';

/* ── Shared mini-components ── */

/** Mini app header (Great Vibes event name + profile icon) - matches real AppHeader */
function MiniHeader() {
  return (
    <div className="hps__app-header">
      <span className="hps__app-title">Dana &amp; Itai</span>
      <span className="hps__app-profile">{HIcon.person}</span>
    </div>
  );
}

/** Mini tab bar (grid / chats / likes) - matches real TabBar */
function MiniTabBar({ active }: { active: 'grid' | 'chat' | 'likes' }) {
  return (
    <div className="hps__tabbar">
      <span className={active === 'grid' ? 'hps__tab hps__tab--on' : 'hps__tab'}>
        {HIcon.grid(active === 'grid' ? 'var(--primary, #D4A59A)' : 'currentColor')}
        <span>גריד</span>
      </span>
      <span className={active === 'chat' ? 'hps__tab hps__tab--on' : 'hps__tab'}>
        {HIcon.chat(active === 'chat' ? 'var(--primary, #D4A59A)' : 'currentColor')}
        <span>צ׳אטים</span>
      </span>
      <span className={active === 'likes' ? 'hps__tab hps__tab--on' : 'hps__tab'}>
        {HIcon.heart(active === 'likes' ? 'var(--primary, #D4A59A)' : 'currentColor')}
        <span>לייקים</span>
        <span className="hps__tab-badge">3</span>
      </span>
    </div>
  );
}

/* ── Individual screens ── */

function OrgFormScreen() {
  return (
    <div className="hps hps--form">
      {/* Wizard progress rail */}
      <div className="hps__wizard-progress">
        <div className="hps__wizard-rail">
          <div className="hps__wizard-fill" style={{ width: '40%' }} />
        </div>
        <div className="hps__wizard-steps">
          {['סוג', 'פרטים', 'רקע', 'פוסטר', 'הודעות'].map((s, i) => (
            <span key={s} className={`hps__wizard-dot${i < 2 ? ' hps__wizard-dot--done' : i === 2 ? ' hps__wizard-dot--active' : ''}`}>{i < 2 ? '✓' : i + 1}</span>
          ))}
        </div>
      </div>
      <div className="hps__form-title">פרטי האירוע</div>
      <div className="hps__fields">
        <div className="hps__input-group">
          <span className="hps__input-label">סוג אירוע</span>
          <div className="hps__event-types">
            <span className="hps__event-chip">מסיבה 🎉</span>
            <span className="hps__event-chip hps__event-chip--on">חתונה 💒</span>
            <span className="hps__event-chip">מיטאפ 🤝</span>
          </div>
        </div>
        <div className="hps__input-group">
          <span className="hps__input-label">שם האירוע</span>
          <div className="hps__input-box">החתונה של דנה ואור</div>
        </div>
        <div className="hps__input-group">
          <span className="hps__input-label">תאריך התחלה</span>
          <div className="hps__input-box">15.06.2026 · 20:00</div>
        </div>
        <div className="hps__input-group">
          <span className="hps__input-label">תאריך סיום</span>
          <div className="hps__input-box hps__input-box--muted">16.06.2026 · 02:00</div>
        </div>
      </div>
      <div className="hps__btn">המשך ←</div>
    </div>
  );
}

function OrgPayScreen() {
  return (
    <div className="hps hps--pay">
      <div className="hps__bar">תשלום מאובטח 🔒</div>
      <div className="hps__pay-amount">₪300</div>
      <div className="hps__pay-label">תשלום חד-פעמי · הכל כלול</div>
      <div className="hps__pay-methods">
        <div className="hps__pay-method hps__pay-method--active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          אשראי
        </div>
        <div className="hps__pay-method">BIT</div>
      </div>
      <div className="hps__fields">
        <div className="hps__input-group">
          <span className="hps__input-label">מספר כרטיס</span>
          <div className="hps__input-box" dir="ltr">•••• •••• •••• 4242</div>
        </div>
        <div className="hps__pay-row">
          <div className="hps__input-group hps__input-group--half">
            <span className="hps__input-label">תוקף</span>
            <div className="hps__input-box" dir="ltr">09/28</div>
          </div>
          <div className="hps__input-group hps__input-group--half">
            <span className="hps__input-label">CVV</span>
            <div className="hps__input-box" dir="ltr">•••</div>
          </div>
        </div>
      </div>
      <div className="hps__btn hps__btn--glow">שלמו ₪300</div>
      <div className="hps__pay-secure">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
        תשלום מוצפן ומאובטח
      </div>
    </div>
  );
}

function OrgPosterScreen() {
  return (
    <div className="hps hps--poster">
      <div className="hps__bar">הפוסטר שלכם מוכן! ✨</div>
      <div className="hps__poster-preview">
        <div className="hps__poster-card">
          <div className="hps__poster-event-tag">Eventa</div>
          <div className="hps__poster-title">החתונה של<br/>דנה ואור</div>
          <div className="hps__poster-date">15.06.2026</div>
          <div className="hps__poster-qr">
            <div className="hps__qr-box" aria-label="QR code mockup">
              {Array.from({ length: 49 }).map((_, i) => (
                <div key={i} className={`hps__qr-cell${[0,1,2,4,5,6,7,9,13,14,16,17,20,21,22,24,25,27,28,30,31,32,34,35,42,43,44,46,47,48].includes(i) ? ' hps__qr-cell--on' : ''}`} />
              ))}
            </div>
          </div>
          <div className="hps__poster-sub">סרקו להצטרפות 💕</div>
        </div>
      </div>
      <div className="hps__poster-actions">
        <div className="hps__btn hps__btn--sm">📥 הורדה</div>
        <div className="hps__btn hps__btn--sm hps__btn--outline">📤 שיתוף</div>
      </div>
    </div>
  );
}

function OrgSmsScreen() {
  return (
    <div className="hps hps--wa">
      <div className="hps__wa-header">
        <div className="hps__wa-avatar">E</div>
        <span className="hps__wa-name">Eventa</span>
      </div>
      <div className="hps__wa-chat">
        <div className="hps__wa-bubble">
          <p>מגיע/ה לחתונה של דנה ואור? את/ה רווק/ה? 💍</p>
          <p>באירוע תהיה לכם הזדמנות להצטרף לאפליקציית Eventa - ולראות את שאר הרווקים והרווקות שיהיו שם.</p>
          <p>אל תדאגו - זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒</p>
          <p>כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח… אולי תשיגו משהו מעניין 😏</p>
          <p className="hps__wa-link">🔗 קישור להצטרפות</p>
          <p>נתראה באירוע! 🎉</p>
        </div>
      </div>
    </div>
  );
}

function OrgPlaceScreen() {
  return (
    <div className="hps hps--place">
      <div className="hps__place-status-top">
        <div className="hps__place-dot" />
        <span>האירוע פעיל</span>
      </div>
      <div className="hps__place-visual">
        <div className="hps__place-poster-mockup">
          <div className="hps__place-poster-inner">
            <span className="hps__place-poster-name">דנה ואור</span>
            <div className="hps__place-mini-qr">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`hps__qr-cell${[0,2,3,5,6,8].includes(i) ? ' hps__qr-cell--on' : ''}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="hps__place-locations">
          <div className="hps__place-loc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            כניסה
          </div>
          <div className="hps__place-loc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/></svg>
            בר
          </div>
          <div className="hps__place-loc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
            מסך
          </div>
        </div>
      </div>
      <div className="hps__place-live-stats">
        <div className="hps__place-live-stat">
          <span className="hps__place-live-n">47</span>
          <span>נרשמו</span>
        </div>
        <div className="hps__place-live-stat">
          <span className="hps__place-live-n">12</span>
          <span>מאצ׳ים</span>
        </div>
        <div className="hps__place-live-stat">
          <span className="hps__place-live-n">89</span>
          <span>לייקים</span>
        </div>
      </div>
      <div className="hps__place-tip">האורחים סורקים ומצטרפים תוך שניות ⚡</div>
    </div>
  );
}

function GuestScanScreen() {
  return (
    <div className="hps hps--scan">
      <div className="hps__scan-viewfinder">
        <div className="hps__scan-corners" />
        <div className="hps__scan-line" />
      </div>
      <div className="hps__scan-text">סרקו את קוד ה-QR</div>
      <div className="hps__scan-hint">או לחצו על הקישור שקיבלתם</div>
    </div>
  );
}

function GuestRegisterScreen() {
  return (
    <div className="hps hps--register">
      <div className="hps__bar">הצטרפות מהירה</div>
      {/* OTP verification step */}
      <div className="hps__otp-section">
        <span className="hps__otp-label">קוד אימות נשלח ל-</span>
        <span className="hps__otp-phone" dir="ltr">+972 54-•••-••89</span>
        <div className="hps__otp-boxes">
          {['3', '7', '9', '2', '', ''].map((d, i) => (
            <span key={i} className={`hps__otp-box${d ? ' hps__otp-box--filled' : ''}${i === 4 ? ' hps__otp-box--cursor' : ''}`}>{d}</span>
          ))}
        </div>
      </div>
      {/* Profile form fields */}
      <div className="hps__reg-avatar">
        <img className="hps__reg-photo" src="/demo/noa.jpg" alt="נועה" />
        <span className="hps__reg-photo-edit">📷</span>
      </div>
      <div className="hps__fields">
        <div className="hps__input-group">
          <span className="hps__input-label">שם</span>
          <div className="hps__input-box">נועה</div>
        </div>
        <div className="hps__input-group">
          <span className="hps__input-label">גיל</span>
          <div className="hps__input-box">24</div>
        </div>
      </div>
      <div className="hps__btn">בואו נתחיל! 🎉</div>
    </div>
  );
}

function GuestDiscoverScreen() {
  return (
    <div className="hps hps--discover">
      <MiniHeader />
      {/* View toggle pill - matches real app */}
      <div className="hps__view-toggle">
        <span className="hps__vt-btn hps__vt-btn--on">{HIcon.grid('#1a1a1a')}</span>
        <span className="hps__vt-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="3"/></svg>
        </span>
      </div>
      {/* Real photo grid - 3 columns, actual /demo/ photos */}
      <div className="hps__grid-real">
        {GRID_USERS.map((u) => (
          <div key={u.name} className="hps__grid-card">
            <img src={u.photo} alt={u.name} draggable={false} />
            <div className="hps__grid-overlay">
              <span className="hps__grid-name">{u.name}</span>
            </div>
          </div>
        ))}
      </div>
      <MiniTabBar active="grid" />
    </div>
  );
}

function GuestMatchScreen() {
  return (
    <div className="hps hps--match">
      <div className="hps__match-backdrop" />
      <div className="hps__match-card">
        <div className="hps__match-title">✨ יש לכם מאצ׳!</div>
        <div className="hps__match-subtitle">גם דניאל עשה לך לייק!</div>
        <div className="hps__match-pair">
          <div className="hps__match-ring"><img src="/demo/noa.jpg" alt="נועה" /></div>
          <div className="hps__match-heart-beat">{HIcon.heartFill('#f87171')}</div>
          <div className="hps__match-ring"><img src="/demo/daniel.jpg" alt="דניאל" /></div>
        </div>
        <div className="hps__btn">שלחו הודעה 💬</div>
        <div className="hps__match-skip">המשיכו לגלול</div>
      </div>
    </div>
  );
}

function GuestChatScreen() {
  return (
    <div className="hps hps--chat">
      {/* Chat header with avatar - matches real demo-chat-hdr */}
      <div className="hps__chat-header">
        <span className="hps__chat-back">{HIcon.back}</span>
        <img className="hps__chat-avatar" src="/demo/daniel.jpg" alt="דניאל" />
        <span className="hps__chat-name">דניאל</span>
      </div>
      <div className="hps__chat-messages">
        <div className="hps__msg hps__msg--system">✨ יש לכם מאצ׳!</div>
        <div className="hps__msg hps__msg--received">היי נועה! 😊</div>
        <div className="hps__msg hps__msg--sent">היי! איזה כיף שעשינו מאצ׳</div>
        <div className="hps__msg hps__msg--received">ממש! איפה את באירוע?</div>
        <div className="hps__msg hps__msg--sent">ליד הבר 🍸 בואי!</div>
        <div className="hps__msg hps__msg--received">בדרך! 🏃‍♂️</div>
      </div>
      {/* Input bar - camera + text field + send (matches real app) */}
      <div className="hps__chat-inputbar">
        <span className="hps__chat-cam">{HIcon.camera}</span>
        <div className="hps__chat-field">הקלידו הודעה...</div>
        <span className="hps__chat-send-btn">{HIcon.send}</span>
      </div>
    </div>
  );
}

function GuestPrivacyScreen() {
  return (
    <div className="hps hps--privacy">
      <div className="hps__priv-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #D4A59A)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div className="hps__priv-title">הכל נמחק</div>
      <div className="hps__priv-subtitle">7 ימים אחרי האירוע</div>
      <div className="hps__priv-list">
        <div className="hps__priv-row"><span className="hps__priv-check">✓</span>תמונות ופרופילים</div>
        <div className="hps__priv-row"><span className="hps__priv-check">✓</span>הודעות וצ׳אטים</div>
        <div className="hps__priv-row"><span className="hps__priv-check">✓</span>לייקים ומאצ׳ים</div>
        <div className="hps__priv-row"><span className="hps__priv-check">✓</span>מספרי טלפון</div>
      </div>
      <div className="hps__priv-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        בלי מעקב · בלי פרסומות · בלי עקבות
      </div>
    </div>
  );
}

/* ── Screen lookup map ── */

const SCREEN_MAP: Record<ScreenKey, () => ReactElement> = {
  'org-form': OrgFormScreen,
  'org-pay': OrgPayScreen,
  'org-poster': OrgPosterScreen,
  'org-sms': OrgSmsScreen,
  'org-place': OrgPlaceScreen,
  'guest-scan': GuestScanScreen,
  'guest-register': GuestRegisterScreen,
  'guest-discover': GuestDiscoverScreen,
  'guest-match': GuestMatchScreen,
  'guest-chat': GuestChatScreen,
  'guest-privacy': GuestPrivacyScreen,
};

export function PhoneScreen({ screen }: { screen: ScreenKey }) {
  const Component = SCREEN_MAP[screen];
  return Component ? <Component /> : null;
}
