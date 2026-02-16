import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'מדיניות עוגיות | Eventa',
  description: 'מדיניות העוגיות של Eventa — אילו עוגיות אנו משתמשים ולמה.',
  alternates: { canonical: 'https://www.eventa.productions/cookies' },
};

/* Shared styles */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '12px',
};
const thStyle: React.CSSProperties = {
  textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)',
  color: '#d4a59a', fontWeight: 600, fontSize: '13px',
};
const tdStyle: React.CSSProperties = {
  textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  color: '#bbb', fontSize: '14px', verticalAlign: 'top',
};
const boldText: React.CSSProperties = { ...textStyle, fontWeight: 600, marginTop: '14px' };

export default function CookiesPage() {
  return (
    <LegalPageLayout title="מדיניות עוגיות" updatedAt="פברואר 2026">

      {/* Intro */}
      <div style={sectionStyle}>
        <p style={textStyle}>
          השירות משתמש ב<strong>עוגיות חיוניות</strong> להפעלת התחברות ואבטחת סשן.
          איננו משתמשים בעוגיות פרסום או מעקב.
        </p>
      </div>

      {/* טבלת עוגיות */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>עוגיות עיקריות</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>שם העוגייה</th>
              <th style={thStyle}>מטרה</th>
              <th style={thStyle}>משך</th>
              <th style={thStyle}>סוג</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code style={{ color: '#d4a59a' }}>ws_session</code></td>
              <td style={tdStyle}>התחברות ושמירת מצב סשן משתמש</td>
              <td style={tdStyle}>30 יום</td>
              <td style={tdStyle}>חיונית / פונקציונלית</td>
            </tr>
            <tr>
              <td style={tdStyle}><code style={{ color: '#d4a59a' }}>ws_admin</code></td>
              <td style={tdStyle}>גישה לממשק ניהול (אדמין)</td>
              <td style={tdStyle}>24 שעות</td>
              <td style={tdStyle}>חיונית / פונקציונלית</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* אבטחה */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>מאפייני אבטחה</h2>
        <p style={textStyle}>
          כל העוגיות מוגדרות עם מאפייני אבטחה: <strong>HttpOnly</strong> (אינן נגישות ל-JavaScript),{' '}
          <strong>Secure</strong> (בסביבת פרודקשן), ו-<strong>SameSite</strong> (הגנה מפני CSRF).
        </p>
      </div>

      {/* ניהול */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>ניהול עוגיות</h2>
        <p style={textStyle}>
          העוגיות הן פונקציונליות ונדרשות להפעלת השירות. ניתן למחוק עוגיות דרך הגדרות הדפדפן,
          אך ייתכן שחלק מהשירות לא יעבוד לאחר מכן.
        </p>
        <p style={boldText}>
          Eventa אינה משתמשת בעוגיות לצרכי פרסום, מעקב, או אנליטיקה.
        </p>
      </div>

    </LegalPageLayout>
  );
}
