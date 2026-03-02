'use client';

import { useState } from 'react';

interface MessagePreviewProps {
  eventName: string;
  startsAt: string;
}

function formatTime(startsAt: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

export default function MessagePreview({ eventName, startsAt }: MessagePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const timeStr = formatTime(startsAt);

  return (
    <div className="portal-section">
      <h2 className="portal-section-title">💬 ההודעה שהאורחים יקבלו</h2>

      <button
        type="button"
        className="portal-guide-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{ marginBottom: expanded ? 12 : 0 }}
      >
        {expanded ? '▲' : '▼'} תצוגה מקדימה של ההודעה
      </button>

      {expanded && (
        <div className="wa-phone-frame">
          {/* ── WhatsApp top bar ── */}
          <div className="wa-topbar">
            <svg className="wa-back-arrow" viewBox="0 0 24 24" fill="none">
              <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="wa-topbar-avatar">E</div>
            <div className="wa-topbar-info">
              <span className="wa-topbar-name">Eventa</span>
              <span className="wa-topbar-status">online</span>
            </div>
            <div className="wa-topbar-actions">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </div>
          </div>

          {/* ── Chat wallpaper area ── */}
          <div className="wa-chat-area">
            {/* Encryption notice */}
            <div className="wa-encrypt-badge">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style={{ opacity: 0.6 }}><path d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 6H6V5a2 2 0 1 1 4 0v2z"/></svg>
              {' '}ההודעות מוצפנות מקצה לקצה
            </div>

            {/* Message bubble */}
            <div className="wa-msg-row">
              <div className="wa-msg-bubble">
                <div className="wa-msg-tail" />
                <p className="wa-msg-text">
                  מגיעים ל{eventName}? את/ה רווק/ה? 💍
                </p>
                <p className="wa-msg-text">
                  הם מצאו את אהבתם, עכשיו תורכם! ❤️
                </p>
                <p className="wa-msg-text" style={{ marginTop: 4 }}>
                  באירוע תהיה לכם הזדמנות להצטרף לאפליקציית <strong>Eventa</strong> — ולראות את שאר הרווקים והרווקות שיהיו שם.
                </p>
                <p className="wa-msg-text" style={{ marginTop: 4 }}>
                  אל תדאגו — זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒
                </p>
                <p className="wa-msg-text" style={{ marginTop: 4 }}>
                  כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח…{'\n'}אולי תשיגו משהו מעניין 😏
                </p>
                <p className="wa-msg-link">
                  🔗 קישור להצטרפות לאירוע
                </p>
                <span className="wa-msg-meta">
                  {timeStr}
                  <svg className="wa-msg-check" viewBox="0 0 16 11" width="16" height="11">
                    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178L6.12 6.7 3.373 4.956a.476.476 0 0 0-.58.048.4.4 0 0 0-.104.58l3.2 3.6a.478.478 0 0 0 .352.158h.03a.46.46 0 0 0 .343-.168l4.738-5.937a.44.44 0 0 0-.28-.584z" fill="#53bdeb"/>
                    <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178L9.12 6.7 8.373 5.956" fill="none" stroke="#53bdeb" strokeWidth="0.7"/>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* ── Bottom input bar ── */}
          <div className="wa-input-bar">
            <div className="wa-input-row">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#8696a0"><path d="M9.153 11.603c.795 0 1.44-.88 1.44-1.962s-.645-1.96-1.44-1.96-1.44.879-1.44 1.96.645 1.962 1.44 1.962zm5.694 0c.795 0 1.44-.88 1.44-1.962s-.645-1.96-1.44-1.96-1.44.879-1.44 1.96.645 1.962 1.44 1.962zM12 17.27c2.2 0 4.074-1.19 5.1-2.96l-1.349-.625c-.77 1.34-2.148 2.247-3.755 2.247-1.607 0-2.985-.908-3.755-2.248L6.89 14.31C7.926 16.08 9.8 17.27 12 17.27zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/></svg>
              <div className="wa-input-field">הקלד הודעה</div>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#8696a0"><path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.501.501 1.134.814 1.753.871.654.06 1.254-.14 1.69-.577l5.5-5.497a.75.75 0 1 0-1.06-1.06l-5.5 5.498a.63.63 0 0 1-.448.12.96.96 0 0 1-.618-.31 1.122 1.122 0 0 1-.274-.538.63.63 0 0 1 .162-.467l7.916-7.915c.763-.762 2.088-.711 2.963.165.434.436.692 1.002.738 1.49.045.51-.154 1.015-.564 1.426l-9.547 9.547a4.08 4.08 0 0 1-2.913 1.205 4.08 4.08 0 0 1-2.913-1.205A4.08 4.08 0 0 1 3.316 15.556V15.556z"/></svg>
            </div>
            <div className="wa-mic-btn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.003H4.761c0 3.885 3.18 7.06 7.06 7.237v3.352h2.178V18.648c3.882-.178 7.06-3.352 7.06-7.237h-2.822z"/></svg>
            </div>
          </div>

          <p className="wa-disclaimer">
            * ההודעה נשלחת אוטומטית דרך WhatsApp. התוכן המדויק עשוי להשתנות מעט.
          </p>
        </div>
      )}
    </div>
  );
}
