import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';

export const metadata: Metadata = {
  title: 'טיפים לבטיחות | Eventa',
  description: 'טיפים לבטיחות השימוש ב-Eventa - כיצד ליהנות מהיכרויות באירועים בצורה בטוחה.',
  alternates: { canonical: 'https://www.eventa.productions/safety' },
};

/* Shared styles */
const tipStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '20px',
  padding: '16px',
  background: 'rgba(212, 165, 154, 0.06)',
  borderRadius: '12px',
  border: '1px solid rgba(212, 165, 154, 0.1)',
};
const iconStyle: React.CSSProperties = { fontSize: '22px', flexShrink: 0, lineHeight: '28px' };
const tipTextStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: 0 };

const tips = [
  { icon: '🤝', text: 'היכרות באירוע צריכה להיות בהסכמה ובכבוד. אם מישהו לא מעוניין - עוצרים.' },
  { icon: '📍', text: 'מומלץ להיפגש במקום ציבורי בתוך האירוע, לא במקום מבודד.' },
  { icon: '🔒', text: 'אל תשתפו מיד פרטים רגישים (כתובת, עבודה, מצב משפחתי וכו\').' },
  { icon: '🚫', text: 'אם מישהו מתנהג בצורה מטרידה / מאיימת - חסמו אותם מיד.' },
  { icon: '👫', text: 'אם אתם מרגישים לא בטוחים - פנו לחברים / מארגני האירוע.' },
];

export default function SafetyPage() {
  return (
    <SitePageLayout title="טיפים לבטיחות">

      {tips.map((tip, i) => (
        <div key={i} style={tipStyle}>
          <span style={iconStyle}>{tip.icon}</span>
          <p style={tipTextStyle}>{tip.text}</p>
        </div>
      ))}

    </SitePageLayout>
  );
}
