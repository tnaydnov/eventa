'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import SitePageLayout from '@/components/SitePageLayout';

/* ═══════════════════════════════════════════
   Data — Two journeys, each with steps
   ═══════════════════════════════════════════ */

type Step = {
  title: string;
  desc: string;
  /** Which phone screen mockup to show */
  screen: string;
};

const ORGANIZER_STEPS: Step[] = [
  {
    title: 'ממלאים טופס הזמנה',
    desc: 'בוחרים סוג אירוע, תאריך, רקע מותאם, ואם לשלוח הודעות לאורחים. הכל בטופס אחד פשוט.',
    screen: 'org-form',
  },
  {
    title: 'משלמים באופן מאובטח',
    desc: 'תשלום מיידי דרך האתר — כרטיס אשראי או BIT. ברגע שהתשלום עובר, אנחנו מתחילים לעבוד.',
    screen: 'org-pay',
  },
  {
    title: 'מקבלים פוסטר QR מעוצב',
    desc: 'תוך 48 שעות תקבלו למייל פוסטר מוכן להדפסה עם קוד QR וקישור — מותאם לסגנון האירוע שלכם.',
    screen: 'org-poster',
  },
  {
    title: 'שולחים הודעות לאורחים',
    desc: 'בחרתם לשלוח? העלו רשימת טלפונים ואנחנו שולחים הודעה עם קישור הצטרפות. לא בחרתם? הפוסטר עושה את העבודה.',
    screen: 'org-sms',
  },
  {
    title: 'מציבים את הפוסטר באירוע',
    desc: 'בכניסה, על הבר, על מסך — אתם בוחרים. האורחים סורקים ומצטרפים תוך שניות. הכל מוכן.',
    screen: 'org-place',
  },
];

const GUEST_STEPS: Step[] = [
  {
    title: 'רואים את הפוסטר',
    desc: 'מגיעים לאירוע, רואים פוסטר מעוצב עם קוד QR. סורקים עם המצלמה או לוחצים על קישור — בלי להוריד שום אפליקציה.',
    screen: 'guest-scan',
  },
  {
    title: 'נרשמים תוך דקה',
    desc: 'אימות מהיר עם SMS, בוחרים תמונה, שם, גיל ומשפט קצר. הפרופיל מוכן — ואתם בפנים.',
    screen: 'guest-register',
  },
  {
    title: 'מגלים מי פה',
    desc: 'רואים את כל הרווקים והרווקות באירוע. גוללים בגריד, עוברים על פרופילים, מוצאים מישהו שתופס את העין.',
    screen: 'guest-discover',
  },
  {
    title: 'עושים לייק ומקבלים מאצ\'',
    desc: 'לחצתם על הלב? אם גם הצד השני לחץ — יש מאצ\'! הכל אנונימי עד שזה הדדי. בלי מבוכה.',
    screen: 'guest-match',
  },
  {
    title: 'שולחים הודעה ונפגשים',
    desc: 'אחרי מאצ\' נפתח צ\'אט פרטי. שלחו הודעה, תאמו מפגש — הם ממש שם, באותו אירוע.',
    screen: 'guest-chat',
  },
  {
    title: 'הכל נמחק. פרטיות מלאה.',
    desc: '7 ימים אחרי האירוע כל המידע נמחק אוטומטית. בלי מעקב, בלי פרסומות, בלי עקבות. רק הרגע.',
    screen: 'guest-privacy',
  },
];

type Journey = 'organizer' | 'guest';

/* ═══════════════════════════════════════════
   Phone screen mockups — realistic, matches
   the actual Eventa app UI from DemoPhone
   ═══════════════════════════════════════════ */

/* Real user photos & data (subset of DemoPhone USERS) */
const GRID_USERS = [
  { name: 'נועה', age: 24, photo: '/demo/noa.jpg' },
  { name: 'איתי', age: 27, photo: '/demo/itay.jpg' },
  { name: 'מאיה', age: 25, photo: '/demo/maya.jpg' },
  { name: 'דניאל', age: 28, photo: '/demo/daniel.jpg' },
  { name: 'שיר', age: 23, photo: '/demo/shir.jpg' },
  { name: 'עומר', age: 26, photo: '/demo/omer.jpg' },
  { name: 'תמר', age: 25, photo: '/demo/tamar.jpg' },
  { name: 'יונתן', age: 29, photo: '/demo/yonatan.jpg' },
  { name: 'ליאור', age: 24, photo: '/demo/lior.jpg' },
];

/* SVG icons — exact copies from the real app tab bar */
const HIcon = {
  grid: (c = 'currentColor') => <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  chat: (c = 'currentColor') => <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  heart: (c = 'currentColor') => <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  heartFill: (c = '#f87171') => <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  send: <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>,
  camera: <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  person: <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  back: <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l7-7-7-7"/></svg>,
};

/** Mini app header (Great Vibes event name + profile icon) — matches real AppHeader */
function MiniHeader() {
  return (
    <div className="hps__app-header">
      <span className="hps__app-title">Dana &amp; Itai</span>
      <span className="hps__app-profile">{HIcon.person}</span>
    </div>
  );
}

/** Mini tab bar (grid / chats / likes) — matches real TabBar */
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

function PhoneScreen({ screen }: { screen: string }) {
  switch (screen) {
    /* ── Organizer screens ── */
    case 'org-form':
      return (
        <div className="hps hps--form">
          {/* Wizard progress rail */}
          <div className="hps__wizard-progress">
            <div className="hps__wizard-rail">
              <div className="hps__wizard-fill" style={{ width: '40%' }} />
            </div>
            <div className="hps__wizard-steps">
              {['סוג', 'פרטים', 'רקע', 'פוסטר', 'הודעות'].map((s, i) => (
                <span key={i} className={`hps__wizard-dot${i < 2 ? ' hps__wizard-dot--done' : i === 2 ? ' hps__wizard-dot--active' : ''}`}>{i < 2 ? '✓' : i + 1}</span>
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
    case 'org-pay':
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
    case 'org-poster':
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
    case 'org-sms':
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
    case 'org-place':
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

    /* ── Guest screens ── */
    case 'guest-scan':
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
    case 'guest-register':
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
    case 'guest-discover':
      return (
        <div className="hps hps--discover">
          <MiniHeader />
          {/* View toggle pill — matches real app */}
          <div className="hps__view-toggle">
            <span className="hps__vt-btn hps__vt-btn--on">{HIcon.grid('#1a1a1a')}</span>
            <span className="hps__vt-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="3"/></svg>
            </span>
          </div>
          {/* Real photo grid — 3 columns, actual /demo/ photos */}
          <div className="hps__grid-real">
            {GRID_USERS.map((u, i) => (
              <div key={i} className="hps__grid-card">
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
    case 'guest-match':
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
    case 'guest-chat':
      return (
        <div className="hps hps--chat">
          {/* Chat header with avatar — matches real demo-chat-hdr */}
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
          {/* Input bar — camera + text field + send (matches real app) */}
          <div className="hps__chat-inputbar">
            <span className="hps__chat-cam">{HIcon.camera}</span>
            <div className="hps__chat-field">הקלידו הודעה...</div>
            <span className="hps__chat-send-btn">{HIcon.send}</span>
          </div>
        </div>
      );
    case 'guest-privacy':
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
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════ */

export default function HowItWorksPage() {
  const [journey, setJourney] = useState<Journey>('organizer');
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = journey === 'organizer' ? ORGANIZER_STEPS : GUEST_STEPS;
  const current = steps[step];

  const goTo = useCallback((idx: number) => {
    if (idx === step || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setStep(idx);
      setTransitioning(false);
    }, 250);
  }, [step, transitioning]);

  const next = useCallback(() => {
    if (step < steps.length - 1) goTo(step + 1);
  }, [step, steps.length, goTo]);

  const prev = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  /* Switch journey → reset to step 0 */
  const switchJourney = useCallback((j: Journey) => {
    if (j === journey) return;
    setTransitioning(true);
    setTimeout(() => {
      setJourney(j);
      setStep(0);
      setTransitioning(false);
    }, 250);
  }, [journey]);

  /* Keyboard nav */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') next();      // RTL: left = forward
      if (e.key === 'ArrowRight') prev();     // RTL: right = back
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  /* Auto-advance timer: progress bar fills over 6s then moves to next */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (paused) return;
    timerRef.current = setTimeout(() => {
      if (step < steps.length - 1) {
        goTo(step + 1);
      }
    }, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step, steps.length, goTo, paused]);

  return (
    <SitePageLayout full className="hiw">
      <div className="hiw__content">

        {/* ═══ Hero ═══ */}
        <div className="hiw__hero">
          <h1 className="hiw__title">איך Eventa עובדת?</h1>
          <p className="hiw__subtitle">
            מהרגע שאתם מזמינים — ועד הרגע שהאורחים שלכם מוצאים את הלב.<br />
            צפו בחוויה דרך שני הצדדים.
          </p>
        </div>

        {/* ═══ Journey toggle ═══ */}
        <div className="hiw__toggle" role="tablist" aria-label="בחירת נקודת מבט">
          <button
            role="tab"
            aria-selected={journey === 'organizer'}
            className={`hiw__toggle-btn${journey === 'organizer' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('organizer')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
            <span>העיניים של המארגן</span>
          </button>
          <button
            role="tab"
            aria-selected={journey === 'guest'}
            className={`hiw__toggle-btn${journey === 'guest' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('guest')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
            <span>העיניים של האורח</span>
          </button>
        </div>

        {/* ═══ Story viewer ═══ */}
        <div className="hiw__story" role="tabpanel">

          {/* ── Progress bars (IG-style) ── */}
          <div className="hiw__progress" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
            {steps.map((_, i) => (
              <div key={i} className="hiw__progress-track">
                <div
                  className={`hiw__progress-fill${i < step ? ' hiw__progress-fill--done' : i === step ? ' hiw__progress-fill--active' : ''}`}
                  style={i === step ? { animationDuration: paused ? '0s' : '6s', animationPlayState: paused ? 'paused' : 'running' } : undefined}
                />
              </div>
            ))}
            <button
              className="hiw__pause-btn"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'המשך הצגה אוטומטית' : 'השהה הצגה אוטומטית'}
            >
              {paused ? '▶' : '⏸'}
            </button>
          </div>

          {/* ── Main layout: text + phone ── */}
          <div className="hiw__stage">

            {/* Text side */}
            <div className={`hiw__text${transitioning ? ' hiw__text--out' : ''}`} aria-live="polite">
              <div className="hiw__step-badge">{step + 1}</div>
              <h2 className="hiw__step-title">{current.title}</h2>
              <p className="hiw__step-desc">{current.desc}</p>
              <div className="hiw__step-counter">
                {step + 1} / {steps.length}
              </div>
            </div>

            {/* Phone side — decorative mockup, hidden from screen readers */}
            <div className="hiw__phone-wrap" aria-hidden="true">
              <div className="hiw__phone">
                <div className="hiw__phone-notch" />
                <div className={`hiw__phone-screen${transitioning ? ' hiw__phone-screen--out' : ''}`}>
                  <PhoneScreen screen={current.screen} />
                </div>
              </div>
            </div>

          </div>

          {/* ── Navigation arrows ── */}
          <div className="hiw__nav">
            <button
              className="hiw__nav-btn"
              onClick={prev}
              disabled={step === 0}
              aria-label="הקודם"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button
              className="hiw__nav-btn"
              onClick={next}
              disabled={step === steps.length - 1}
              aria-label="הבא"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          </div>

          {/* ── Tap zones (click left/right of phone) ── */}
          <button className="hiw__tap hiw__tap--prev" onClick={prev} aria-label="הקודם" tabIndex={-1} />
          <button className="hiw__tap hiw__tap--next" onClick={next} aria-label="הבא" tabIndex={-1} />
        </div>

        {/* ═══ CTA ═══ */}
        <div className="hiw__cta">
          <h2 className="hiw__cta-title">מוכנים?</h2>
          <p className="hiw__cta-sub">
            הפעילו את Eventa באירוע שלכם ותנו לאורחים חוויה שהם יזכרו.
          </p>
          <a href="/dating/order" className="hiw__cta-btn">
            <span>להזמנה</span>
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
        </div>

      </div>
    </SitePageLayout>
  );
}
