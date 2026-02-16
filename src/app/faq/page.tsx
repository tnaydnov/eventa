import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'שאלות נפוצות | Eventa',
  description: 'שאלות נפוצות על Eventa — איך נכנסים, מי רואה את הפרופיל, כמה זמן נשמר המידע ועוד.',
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
    q: 'איך נכנסים לאירוע?',
    a: 'באמצעות QR שנמסר באירוע.',
  },
  {
    q: 'מי רואה את הפרופיל שלי?',
    a: 'רק משתתפים באותו אירוע שיש להם גישה.',
  },
  {
    q: 'איך חוסמים מישהו?',
    a: 'דרך כרטיס פרופיל / צ\'אט (אם האפשרות זמינה). חסימה מסתירה את שני הצדדים.',
  },
  {
    q: 'כמה זמן המידע נשמר?',
    a: 'בדרך כלל עד 7 ימים מסיום האירוע, ואז נמחק אוטומטית (ייתכן עיכוב טכני קצר).',
  },
  {
    q: 'אפשר למחוק חשבון?',
    a: 'כן, דרך ההגדרות (אם קיימות) או פנייה למפעיל.',
  },
  {
    q: 'האם יש אימות זהות?',
    a: 'לא. השירות אינו מבצע אימות זהות מלא.',
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
          <p style={questionStyle}>❓ {faq.q}</p>
          <p style={answerStyle}>{faq.a}</p>
        </div>
      ))}

    </LegalPageLayout>
  );
}
