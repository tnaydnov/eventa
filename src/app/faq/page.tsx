import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SitePageLayout from '@/components/SitePageLayout';

export const metadata: Metadata = {
  title: 'שאלות נפוצות | Eventa',
  description: 'שאלות נפוצות על Eventa - איך מזמינים, כמה זה עולה, מה האורחים צריכים לעשות ועוד.',
  alternates: { canonical: 'https://www.eventa.productions/faq' },
};

/* ── FAQ data grouped by category ── */

interface FaqItem {
  q: string;
  a: ReactNode;
  /** Plain-text fallback for JSON-LD when `a` contains JSX */
  aText?: string;
}

interface FaqCategory {
  title: string;
  icon: ReactNode;
  items: FaqItem[];
}

const categories: FaqCategory[] = [
  {
    title: 'כללי',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
    items: [
      {
        q: 'מה זה Eventa?',
        a: 'Eventa היא שכבת היכרויות שמתווספת לאירוע שלכם. האורחים סורקים QR או לוחצים על קישור, מאמתים את הנייד עם קוד SMS, בונים פרופיל ומתחילים - לייקים, מאצ\'ים וצ\'אט, ישר מהדפדפן.',
      },
      {
        q: 'לאילו אירועים זה מתאים?',
        a: 'חתונות, מסיבות, אירועי חברה, מיטאפים - כל אירוע שיש בו רווקים ורווקות שרוצים ליצור חיבורים.',
      },
      {
        q: 'כמה אורחים יכולים להשתמש?',
        a: 'אין הגבלה מעשית. המערכת בנויה להתמודד עם אירועים מכל גודל.',
      },
    ],
  },
  {
    title: 'איך האורחים משתמשים',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
    ),
    items: [
      {
        q: 'האם האורחים צריכים להוריד אפליקציה?',
        a: 'לא. הכל עובד ישר מהדפדפן בטלפון. האורחים סורקים QR, מאמתים את הנייד עם קוד SMS, נרשמים תוך דקה ומתחילים. אפס הורדות.',
      },
      {
        q: 'איך האורחים נכנסים למערכת?',
        a: 'האורחים סורקים QR או לוחצים על קישור (אם בחרתם לשלוח הודעות, הם מקבלים קישור אישי ישירות). הם מזינים מספר טלפון, מקבלים קוד אימות SMS, בונים פרופיל - וזהו.',
      },
      {
        q: 'מה עם אורחים שלא מעוניינים?',
        a: 'ההשתתפות לחלוטין וולונטרית. מי שלא סורק את ה-QR פשוט לא משתתף - זה לא משפיע על שום דבר באירוע.',
      },
    ],
  },
  {
    title: 'הזמנה ותשלום',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    ),
    items: [
      {
        q: 'כמה זמן לוקח לארגן את זה?',
        a: 'ממלאים את הפרטים באתר, משלמים באשראי או BIT, ותוך 48 שעות מקבלים פוסטר מעוצב עם QR כקובץ דיגיטלי - וזהו.',
      },
      {
        q: 'איך משלמים?',
        a: 'התשלום מתבצע ישירות באתר - כרטיס אשראי או BIT. מיידי ומאובטח.',
      },
      {
        q: 'איך מזמינים?',
        a: <>דרך טופס ההזמנה באתר - ממלאים פרטים, משלמים ומקבלים את הפוסטר. מעדיפים שניצור איתכם קשר? השאירו פרטים או שלחו מייל ל-<a href="mailto:contact@eventa.productions" style={{ color: 'var(--primary)', textDecoration: 'none' }}>contact@eventa.productions</a>.</>,
        aText: 'דרך טופס ההזמנה באתר - ממלאים פרטים, משלמים ומקבלים את הפוסטר. מעדיפים שניצור איתכם קשר? השאירו פרטים או שלחו מייל ל-contact@eventa.productions.',
      },
    ],
  },
  {
    title: 'הפוסטר וההודעות',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    ),
    items: [
      {
        q: 'מה קורה עם הפוסטר / ה-QR?',
        a: 'לאחר אישור ההזמנה, אנחנו שולחים לכם פוסטר מעוצב עם קוד QR + לינק הצטרפות כקובץ דיגיטלי. ההדפסה והמיקום באירוע באחריותכם - שימו בכניסה, על הבר, במסך, בסטורי, איפה שבא לכם.',
      },
      {
        q: 'מה זה שליחת הודעות לאורחים?',
        a: 'בתהליך ההזמנה אפשר לבחור לשלוח הודעות לאורחים. מעלים רשימת טלפונים (Excel) ואנחנו שולחים לכל אורח הודעה עם קישור אישי להצטרפות - עוד לפני האירוע.',
      },
      {
        q: 'אפשר להתאים את העיצוב לאירוע?',
        a: 'כן. אפשר לבחור עיצוב לדף הכניסה, רקע מותאם לאפליקציה, כדי שהחוויה תרגיש חלק מהאירוע שלכם.',
      },
    ],
  },
  {
    title: 'פרטיות ואבטחה',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    items: [
      {
        q: 'מה קורה עם המידע אחרי האירוע?',
        a: 'כל המידע האישי של המשתתפים (כולל מספרי הטלפון) נמחק אוטומטית תוך 7 ימים מסיום האירוע. פרטיות מלאה, בלי מעקב, בלי פרסומות.',
      },
      {
        q: 'האם זה בטוח לאורחים?',
        a: 'בהחלט. אימות טלפון עם קוד SMS, מערכת חסימות, כל המשתתפים מוגבלים רק לאירוע הספציפי, והמידע נמחק אוטומטית. אנחנו לא משתפים מידע עם צד שלישי.',
      },
    ],
  },
];

/* Flatten for JSON-LD */
const allFaqs = categories.flatMap((c) => c.items);

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.aText ?? faq.a,
      },
    })),
  };

  return (
    <SitePageLayout title="שאלות נפוצות" wide>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="faq">
        {categories.map((cat) => (
          <div key={cat.title} className="faq__category">
            <div className="faq__category-header">
              <div className="faq__category-icon">{cat.icon}</div>
              <h2 className="faq__category-title">{cat.title}</h2>
            </div>
            {cat.items.map((item) => (
              <details key={item.q} className="faq__item">
                <summary>{item.q}</summary>
                <p className="faq__answer">{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>

    </SitePageLayout>
  );
}
