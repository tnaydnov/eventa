import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'כללי קהילה | Eventa',
  description: 'כללי הקהילה של Eventa — התנהגות מכבדת, תוכן אסור, ומדיניות אכיפה.',
  alternates: { canonical: 'https://www.eventa.productions/community' },
};

/* Shared styles */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const listStyle: React.CSSProperties = { ...textStyle, paddingRight: '20px', listStyleType: 'disc' };
const liStyle: React.CSSProperties = { marginBottom: '8px' };
const introStyle: React.CSSProperties = {
  ...textStyle, fontSize: '16px', fontWeight: 500,
  color: '#e0d0ca', borderRight: '3px solid #d4a59a',
  paddingRight: '16px', marginBottom: '24px',
};

export default function CommunityPage() {
  return (
    <LegalPageLayout title="כללי קהילה">

      <p style={introStyle}>
        המטרה שלנו היא לאפשר היכרות נעימה ובטוחה באירועים.
        שימוש בשירות מחייב התנהגות מכבדת.
      </p>

      {/* אסור בשירות */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>🚫 אסור בשירות</h2>
        <ul style={listStyle}>
          <li style={liStyle}>הטרדה, איומים, סטוקינג, לחץ או כפייה מכל סוג</li>
          <li style={liStyle}>תוכן מיני מפורש, עירום, תמונות אינטימיות, או הצעות פוגעניות</li>
          <li style={liStyle}>התחזות, פרופילים מזויפים, או מידע מטעה מכוון</li>
          <li style={liStyle}>שיתוף פרטים אישיים של אחרים ללא רשות (טלפון / כתובת / רשתות)</li>
          <li style={liStyle}>ספאם, פרסום מסחרי, או קידום עסקים</li>
          <li style={liStyle}>העלאת תמונות / סרטונים של אנשים אחרים ללא הסכמתם</li>
          <li style={liStyle}>צילום מסך והפצה חיצונית של תוכן של אחרים ללא הסכמתם</li>
        </ul>
      </div>

      {/* חסימה ואכיפה */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>🛡️ חסימה ואכיפה</h2>
        <ul style={listStyle}>
          <li style={liStyle}>ניתן לחסום משתמשים מתוך השירות. לפניות נוספות ניתן ליצור קשר עם המפעיל.</li>
          <li style={liStyle}>המפעיל רשאי להסיר תוכן, להגביל תכונות, לחסום או להרחיק משתמשים לפי שיקול דעתו.</li>
          <li style={liStyle}>השירות אינו מתחייב לטיפול בזמן אמת, אך ישתדל לטפל בפניות בהקדם האפשרי.</li>
        </ul>
      </div>

    </LegalPageLayout>
  );
}
