import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'אודות | Eventa',
  description: 'אודות Eventa — שירות עצמאי להיכרויות באירועים.',
  alternates: { canonical: 'https://eventa.productions/about' },
};

const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 16px' };
const highlightStyle: React.CSSProperties = {
  ...textStyle,
  fontSize: '17px',
  fontWeight: 500,
  color: '#e0d0ca',
  borderRight: '3px solid #d4a59a',
  paddingRight: '16px',
  marginBottom: '24px',
};
const linkColor: React.CSSProperties = { color: '#d4a59a', fontWeight: 500 };

export default function AboutPage() {
  return (
    <LegalPageLayout title="אודות Eventa">

      <p style={highlightStyle}>
        Eventa הוא שירות עצמאי שנועד להפוך אירועים לחוויה חברתית יותר —
        היכרות, שיחות ולייקים בין משתתפים באותו אירוע, בצורה זמנית וממוקדת לאירוע.
      </p>

      <p style={textStyle}>
        Eventa אינו קשור לבעלי האולם או למפיקי האירוע, אלא מופעל על-ידי מפעיל השירות באופן עצמאי.
      </p>

      <p style={textStyle}>
        ליצירת קשר — השתמשו באמצעי הקשר המופיעים בשירות, או שלחו מייל ל-<span style={linkColor}>contact@eventa.productions</span>.
      </p>

    </LegalPageLayout>
  );
}
