import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | Eventa',
  description: 'מדיניות הפרטיות של Eventa — כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.',
};

/* Shared styles */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const subHeadingStyle: React.CSSProperties = {
  fontSize: '15px', fontWeight: 600, color: '#d4a59a',
  marginBottom: '8px', marginTop: '16px',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const listStyle: React.CSSProperties = { ...textStyle, paddingRight: '20px', listStyleType: 'disc' };
const liStyle: React.CSSProperties = { marginBottom: '8px' };
const boldText: React.CSSProperties = { ...textStyle, fontWeight: 600, marginTop: '14px' };
const linkColor: React.CSSProperties = { color: '#d4a59a', fontWeight: 500 };

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="מדיניות פרטיות" updatedAt="פברואר 2026">

      {/* מבוא */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>מבוא והגדרות</h2>
        <p style={textStyle}>
          מדיניות פרטיות זו מפרטת כיצד מפעיל השירות של <strong>Eventa</strong> (&quot;המפעיל&quot;, &quot;אנחנו&quot;, &quot;השירות&quot;)
          אוסף, משתמש, מאחסן ומוחק מידע בעת שימוש באפליקציה.
        </p>
        <p style={textStyle}>
          השירות מיועד לשימוש במהלך אירועים ומאפשר יצירת קשרים בין משתתפים באותו אירוע.
        </p>
        <p style={textStyle}>
          אנו פועלים לנקוט אמצעי אבטחה סבירים ולפעול בהתאם לדינים החלים עלינו.
          אם אינך מסכים/ה למדיניות זו, אנא הימנע/י משימוש בשירות.
        </p>
      </div>

      {/* 1 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. מי מפעיל את השירות ופרטי קשר</h2>
        <p style={textStyle}>
          השירות מופעל על-ידי מפעיל השירות (מפעיל פרטי).
          לשאלות או בקשות בנושא פרטיות ניתן לפנות באמצעי הקשר המוצגים בשירות.
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={linkColor}>tnaydnov@gmail.com</span>
        </p>
      </div>

      {/* 2 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. איזה מידע אנו אוספים</h2>
        <p style={textStyle}>אנו אוספים/מעבדים מידע בהתאם לתכונות שבהן נעשה שימוש:</p>

        <h3 style={subHeadingStyle}>א. מידע פרופיל (מסופק על-ידך)</h3>
        <p style={textStyle}>
          שם תצוגה, גיל (דיווח עצמי), מגדר, למי את/ה נמשך/ת (נטייה/העדפה),
          &quot;מחפש/ת&quot;, עיר, ביוגרפיה, ותמונות פרופיל (עד כמות שמוגדרת בשירות).
        </p>

        <h3 style={subHeadingStyle}>ב. מידע תקשורת ותוכן</h3>
        <p style={textStyle}>
          הודעות טקסט, תמונות בצ&apos;אט, הודעות קוליות, התראות הקשורות ללייקים / הודעות.
        </p>

        <h3 style={subHeadingStyle}>ג. מידע התנהגות ותפעול</h3>
        <p style={textStyle}>
          לייקים שנשלחו/התקבלו, התאמות / שיחות, חסימות, סטטוס פעילות
          (למשל עדכון &quot;נראה לאחרונה&quot;, ככל שמופעל בשירות).
        </p>

        <h3 style={subHeadingStyle}>ד. מזהים טכניים</h3>
        <ul style={listStyle}>
          <li style={liStyle}>מזהה טכני / UUID הנשמר בדפדפן (למשל לצורך חיבור מחדש, מניעת שימוש כפול / עקיפת חסימות).</li>
          <li style={liStyle}>פרטי אירוע / משתתף מתוך סשן (eventId, participantId וכו&apos;).</li>
        </ul>
        <p style={textStyle}>
          מזהים אלה עשויים להיחשב מזהים אישיים / מזהים טכניים, גם אם אינם כוללים שם אמיתי.
        </p>
      </div>

      {/* 3 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Cookies ואחסון מקומי (LocalStorage)</h2>
        <p style={textStyle}>השירות משתמש באמצעים טכניים להפעלת התחברות ושמירת סשן:</p>

        <h3 style={subHeadingStyle}>עוגיות חיוניות (Functional / Strictly Necessary)</h3>
        <ul style={listStyle}>
          <li style={liStyle}><strong>ws_session</strong> — עוגיית סשן לצורך התחברות והפעלת השירות (כוללת מזהי אירוע / משתתף).</li>
          <li style={liStyle}><strong>ws_admin</strong> — עוגיית סשן לממשק אדמין.</li>
        </ul>
        <p style={textStyle}>
          העוגיות מוגדרות כעוגיות חיוניות, ואינן מיועדות לפרסום / מעקב / אנליטיקה.
          העוגיות מוגדרות עם מאפייני אבטחה (כגון HttpOnly, Secure בסביבת פרודקשן, SameSite בהתאם להגדרות השירות).
        </p>

        <h3 style={subHeadingStyle}>LocalStorage / אחסון דפדפן</h3>
        <p style={textStyle}>ייתכן שנשמרים בדפדפן מפתחות טכניים כגון:</p>
        <ul style={listStyle}>
          <li style={liStyle}>נתוני גיבוי סשן (לשחזור מצב התחברות)</li>
          <li style={liStyle}>מזהה טכני אקראי (UUID)</li>
          <li style={liStyle}>דגלים פנימיים (למשל &quot;הפרופיל הושלם&quot;)</li>
        </ul>
        <p style={textStyle}>
          באפשרותך למחוק נתונים אלה דרך הגדרות הדפדפן (&quot;ניקוי נתוני אתר&quot;).
        </p>
      </div>

      {/* 4 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. מטרות העיבוד</h2>
        <p style={textStyle}>אנו משתמשים במידע לצורך:</p>
        <ul style={listStyle}>
          <li style={liStyle}>הפעלת השירות (פרופילים, לייקים, צ&apos;אט)</li>
          <li style={liStyle}>אבטחה ומניעת שימוש לרעה (חסימות, בדיקות גישה, מניעת עקיפה, מניעת ספאם)</li>
          <li style={liStyle}>תפעול ותחזוקה (איתור תקלות ושיפור יציבות)</li>
        </ul>
        <p style={boldText}>
          איננו מוכרים מידע אישי ואיננו משתפים מידע למטרות פרסום / שיווק.
        </p>
      </div>

      {/* 5 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. בסיס לעיבוד</h2>
        <p style={textStyle}>הבסיס לעיבוד הוא:</p>
        <ul style={listStyle}>
          <li style={liStyle}>הסכמתך בעת שימוש בשירות</li>
          <li style={liStyle}>הסכמה נפרדת לתכונות הדורשות הרשאות (מיקרופון וכו&apos;)</li>
          <li style={liStyle}>אינטרס לגיטימי של המפעיל לאבטחת השירות, מניעת הונאה, ואכיפת תנאי השימוש</li>
        </ul>
      </div>

      {/* 6 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. שיתוף מידע עם צדדים שלישיים</h2>
        <p style={textStyle}>אנו משתמשים בספקי תשתית טכנית בלבד:</p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>Supabase</strong> — מסד נתונים, אחסון קבצים, תקשורת בזמן אמת</li>
          <li style={liStyle}><strong>Vercel</strong> — אירוח והפצת האתר (CDN / Serverless)</li>
        </ul>
        <p style={boldText}>
          איננו משלבים נכון למועד זה שירותי אנליטיקה / פרסום (כגון Google Analytics, Mixpanel וכו&apos;).
        </p>
      </div>

      {/* 7 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. אבטחת מידע</h2>
        <p style={textStyle}>אנו נוקטים אמצעי אבטחה סבירים, לרבות:</p>
        <ul style={listStyle}>
          <li style={liStyle}>תקשורת מוצפנת (HTTPS / TLS)</li>
          <li style={liStyle}>שימוש בעוגיות HttpOnly ואבטחה מוגברת בסביבת פרודקשן</li>
          <li style={liStyle}>הגנות נגד CSRF, Rate Limiting, וסניטציה לקלט</li>
          <li style={liStyle}>בקרות גישה והרשאות</li>
        </ul>
        <p style={textStyle}>
          יחד עם זאת, אין מערכת חסינה לחלוטין, ולכן אין באפשרותנו להבטיח אבטחה מוחלטת.
        </p>
      </div>

      {/* 8 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. שמירת מידע ומחיקה (Retention)</h2>
        <p style={textStyle}>השירות נועד להיות זמני:</p>
        <ul style={listStyle}>
          <li style={liStyle}>
            מידע אישי הקשור לאירוע (פרופילים, הודעות, תמונות, לייקים, חסימות)
            נמחק בדרך כלל <strong>בתוך עד 7 ימים</strong> מסיום האירוע.
          </li>
          <li style={liStyle}>
            ייתכן עיכוב קצר במחיקה עקב גיבויים טכניים, תקלות, או צורך בהגנה מפני הונאה / עקיפה.
          </li>
          <li style={liStyle}>
            נתונים מצטברים / סטטיסטיים שאינם מזהים משתמשים עשויים להישמר לצרכי תפעול / שיווק
            (למשל: מספר משתתפים, מספר לייקים), ללא פרטי משתמש מזהים.
          </li>
        </ul>
      </div>

      {/* 9 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. זכויות המשתמש/ת</h2>
        <p style={textStyle}>בכפוף לדינים החלים, באפשרותך:</p>
        <ul style={listStyle}>
          <li style={liStyle}>לעדכן פרטים בפרופיל</li>
          <li style={liStyle}>למחוק חשבון (ככל שהאפשרות זמינה בשירות)</li>
          <li style={liStyle}>לבקש עיון / תיקון / מחיקה / הגבלה דרך יצירת קשר עם המפעיל</li>
        </ul>
        <p style={textStyle}>
          <strong>לתשומת לב:</strong> מחיקה מן השירות הפעיל לא בהכרח מוחקת מיד גיבויים טכניים.
        </p>
      </div>

      {/* 10 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>10. קטינים</h2>
        <p style={textStyle}>
          השירות מיועד לבני 18+ בלבד. איננו אוספים ביודעין מידע מקטינים.
          אם יימצא חשד סביר לקטינות — ננקוט צעדים להסרה / חסימה / מחיקה.
        </p>
      </div>

      {/* 11 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>11. העברת מידע מחוץ לישראל</h2>
        <p style={textStyle}>
          ספקי התשתית עשויים לאחסן / לעבד מידע מחוץ לישראל.
          אנו נוקטים צעדים סבירים לוודא שהעברת מידע נעשית תחת אמצעי אבטחה מקובלים.
        </p>
      </div>

      {/* 12 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>12. שינויים במדיניות</h2>
        <p style={textStyle}>
          מדיניות זו עשויה להתעדכן מעת לעת. השינויים יפורסמו בשירות.
          המשך שימוש לאחר פרסום שינוי מהווה הסכמה למדיניות המעודכנת.
        </p>
      </div>

      {/* 13 */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>13. יצירת קשר</h2>
        <p style={textStyle}>
          לפניות פרטיות, שאלות או בקשות — השתמש/י באמצעי הקשר המופיעים בשירות.
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={linkColor}>tnaydnov@gmail.com</span>
        </p>
      </div>

    </LegalPageLayout>
  );
}
