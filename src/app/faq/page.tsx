import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'שאלות נפוצות | Eventa',
  description: 'שאלות נפוצות על Eventa - איך מזמינים, כמה זה עולה, מה האורחים צריכים לעשות ועוד.',
  alternates: { canonical: 'https://www.eventa.productions/faq' },
};

/* Shared styles */
const qaStyle: React.CSSProperties = {
  marginBottom: '24px',
  padding: '20px',
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: '12px',
  border: '1px solid rgba(212, 165, 154, 0.1)',
};
const questionStyle: React.CSSProperties = {
  fontSize: '16px', fontWeight: 600, color: '#d4a59a',
  margin: '0 0 10px', lineHeight: 1.6,
};
const answerStyle: React.CSSProperties = {
  color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: 0,
};

const faqs = [
  {
    q: 'מה זה Eventa?',
    a: 'Eventa היא שכבת היכרויות שמתווספת לאירוע שלכם. האורחים סורקים QR, בונים פרופיל, ומתחילים לגלות אחד את השנייה - לייקים, מאצ\'ים וצ\'אט, ישר מהדפדפן.',
  },
  {
    q: 'לאילו אירועים זה מתאים?',
    a: 'חתונות, בר/בת מצוות, מסיבות, אירועי חברה, אירועים פרטיים - כל אירוע שיש בו רווקים ורווקות שרוצים ליצור חיבורים.',
  },
  {
    q: 'האם האורחים צריכים להוריד אפליקציה?',
    a: 'לא. הכל עובד ישר מהדפדפן בטלפון. האורחים סורקים QR, נרשמים תוך דקה, ומתחילים. אפס הורדות.',
  },
  {
    q: 'כמה זמן לוקח לארגן את זה?',
    a: 'פונים אלינו עם פרטי האירוע, אנחנו מכינים הכל תוך 24 שעות. מקבלים QR מוכן להדפסה - וזהו.',
  },
  {
    q: 'אפשר להתאים את העיצוב לאירוע?',
    a: 'כן. אפשר לבחור עיצוב לדף הכניסה, רקע מותאם לאפליקציה, כדי שהחוויה תרגיש חלק מהאירוע שלכם.',
  },
  {
    q: 'מה קורה עם המידע אחרי האירוע?',
    a: 'כל המידע האישי של המשתתפים נמחק אוטומטית תוך 7 ימים מסיום האירוע. פרטיות מלאה, בלי מעקב, בלי פרסומות.',
  },
  {
    q: 'האם זה בטוח לאורחים?',
    a: 'בהחלט. יש מערכת חסימות, כל המשתתפים מוגבלים רק לאירוע הספציפי, והמידע נמחק אוטומטית. אנחנו לא משתפים מידע עם צד שלישי.',
  },
  {
    q: 'כמה אורחים יכולים להשתמש?',
    a: 'אין הגבלה מעשית. המערכת בנויה להתמודד עם אירועים מכל גודל.',
  },
  {
    q: 'מה עם אורחים שלא מעוניינים?',
    a: 'ההשתתפות לחלוטין וולונטרית. מי שלא סורק את ה-QR פשוט לא משתתף - זה לא משפיע על שום דבר באירוע.',
  },
  {
    q: 'איך יוצרים קשר?',
    a: 'דרך טופס ההזמנה באתר או במייל ל-contact@eventa.productions. נחזור אליכם תוך 24 שעות.',
  },
];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  return (
    <LegalPageLayout title="שאלות נפוצות">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {faqs.map((faq, i) => (
        <div key={i} style={qaStyle}>
          <p style={questionStyle}>{faq.q}</p>
          <p style={answerStyle}>{faq.a}</p>
        </div>
      ))}

    </LegalPageLayout>
  );
}
