'use client';

import { useEffect, useRef } from 'react';
import SitePageLayout from '@/components/SitePageLayout';

/**
 * /how-it-works
 * Explains the full Eventa flow for event organizers.
 * Three paths: pay now, contact-me after form, quick contact.
 * Then a shared "what happens next" section for the event itself.
 */

/* ── Shared timeline for "what happens at the event" ── */
const EVENT_STEPS: { title: string; desc: string }[] = [
  {
    title: 'האורחים נכנסים',
    desc: 'סריקת QR או לחיצה על קישור — אימות מהיר עם SMS, בניית פרופיל תוך דקה. בלי הורדה, ישר מהדפדפן.',
  },
  {
    title: 'הקסם קורה',
    desc: 'לייקים, מאצ׳ים וצ׳אט בזמן אמת — הרווקים והרווקות מגלים אחד את השנייה במהלך האירוע.',
  },
  {
    title: 'הכל נמחק',
    desc: 'תוך 7 ימים מסיום האירוע, כל המידע נמחק אוטומטית. פרטיות מלאה, בלי מעקב, בלי פרסומות.',
  },
];

export default function HowItWorksPage() {
  const pathRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = pathRef.current;
    if (!container) return;
    const items = container.querySelectorAll('.hiw-reveal');
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('hiw-reveal--visible');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <SitePageLayout wide className="hiw">
      <div className="hiw__content" ref={pathRef}>

        {/* ═══ Hero ═══ */}
        <div className="hiw__hero">
          <h1 className="hiw__title">איך Eventa עובדת?</h1>
          <p className="hiw__subtitle">
            שלושה מסלולים להפעלת שכבת ההיכרויות באירוע שלכם.<br />
            בחרו את מה שנוח לכם — אנחנו מטפלים בשאר.
          </p>
        </div>

        {/* ═══ Three paths ═══ */}
        <div className="hiw__paths">

          {/* Path 1 — Pay now */}
          <div className="hiw__path-card hiw-reveal">
            <div className="hiw__path-badge hiw__path-badge--primary">הכי מהיר</div>
            <h2 className="hiw__path-title">הזמנה ותשלום מיידי</h2>
            <ol className="hiw__steps">
              <li>
                <span className="hiw__step-num">1</span>
                <div>
                  <strong>מלאו את טופס ההזמנה</strong>
                  <p>סוג אירוע, תאריכים, רקע מותאם, ובחרו אם לשלוח הודעות WhatsApp לאורחים לפני האירוע.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">2</span>
                <div>
                  <strong>שלמו באופן מאובטח</strong>
                  <p>תשלום מיידי דרך האתר. ברגע שהתשלום מאושר — ההזמנה נכנסת לעבודה.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">3</span>
                <div>
                  <strong>קבלו פוסטר QR מעוצב</strong>
                  <p>תוך 48 שעות תקבלו למייל פוסטר מוכן עם קוד QR וקישור הצטרפות — מוכן להדפסה ולשיתוף דיגיטלי.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">4</span>
                <div>
                  <strong>בחרתם הודעות WhatsApp?</strong>
                  <p>העלו את רשימת מספרי הטלפון של האורחים, ואנחנו נשלח להם הודעה עם קישור להצטרפות לפני האירוע.</p>
                  <p className="hiw__step-note">לא בחרתם? לא צריך לעשות כלום — האורחים יצטרפו דרך הפוסטר באירוע.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">5</span>
                <div>
                  <strong>הדפיסו ומקמו את הפוסטר</strong>
                  <p>שימו אותו בכניסה לאירוע, על הבר, במסך — איפה שהאורחים יראו אותו.</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Path 2 — Full form + contact me */}
          <div className="hiw__path-card hiw-reveal">
            <h2 className="hiw__path-title">מילוי טופס + צרו קשר</h2>
            <ol className="hiw__steps">
              <li>
                <span className="hiw__step-num">1</span>
                <div>
                  <strong>מלאו את כל פרטי האירוע</strong>
                  <p>אותו טופס הזמנה מלא — סוג אירוע, תאריכים, רקע, פוסטר והודעות.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">2</span>
                <div>
                  <strong>לחצו על &quot;צרו איתי קשר&quot;</strong>
                  <p>במקום לשלם, השאירו פרטים ואנחנו ניצור איתכם קשר אישי תוך 48 שעות.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">3</span>
                <div>
                  <strong>נסגור הכל ביחד</strong>
                  <p>נענה על שאלות, נסביר, ונתאם את כל הפרטים — ואז נעביר אתכם לתשלום.</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Path 3 — Quick contact */}
          <div className="hiw__path-card hiw-reveal">
            <h2 className="hiw__path-title">פשוט צרו קשר</h2>
            <ol className="hiw__steps">
              <li>
                <span className="hiw__step-num">1</span>
                <div>
                  <strong>לחצו על &quot;צרו קשר&quot;</strong>
                  <p>בלי למלא טפסים — רק השאירו שם וטלפון.</p>
                </div>
              </li>
              <li>
                <span className="hiw__step-num">2</span>
                <div>
                  <strong>אנחנו חוזרים אליכם</strong>
                  <p>תוך 48 שעות ניצור קשר, נסביר הכל מאפס, ונלווה אתכם בכל השלבים.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* ═══ What happens at the event ═══ */}
        <div className="hiw__event-section hiw-reveal">
          <h2 className="hiw__section-title">ומה קורה באירוע עצמו?</h2>
          <p className="hiw__section-sub">
            אחרי שההזמנה מוכנה והפוסטר מודפס — ככה זה נראה בלילה של האירוע.
          </p>
          <div className="hiw__event-steps">
            {EVENT_STEPS.map((step, i) => (
              <div key={step.title} className="hiw__event-step">
                <span className="hiw__event-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CTA ═══ */}
        <div className="hiw__cta hiw-reveal">
          <h2 className="hiw__cta-title">מוכנים?</h2>
          <p className="hiw__cta-sub">
            מלאו את טופס ההזמנה ותנו לאורחים שלכם חוויה שהם יזכרו.
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
