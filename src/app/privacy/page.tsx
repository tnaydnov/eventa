import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | Wedding Singles',
  description: 'מדיניות הפרטיות של אפליקציית Wedding Singles — כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.',
};

/* Shared styles to keep JSX clean */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const listStyle: React.CSSProperties = { ...textStyle, paddingRight: '20px', listStyleType: 'disc' };
const liStyle: React.CSSProperties = { marginBottom: '8px' };
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
const emailStyle: React.CSSProperties = { color: '#d4a59a', fontWeight: 500 };

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="מדיניות פרטיות" updatedAt="פברואר 2026">

      {/* Intro */}
      <div style={sectionStyle}>
        <p style={textStyle}>
          אפליקציית <strong>Wedding Singles</strong> (&quot;האפליקציה&quot;, &quot;השירות&quot;, &quot;אנחנו&quot;)
          מיועדת ליצירת קשרים בין רווקים ורווקות באירועי חתונה.
          מדיניות פרטיות זו מפרטת כיצד אנו אוספים, מעבדים, מאחסנים ומוחקים את המידע האישי שלכם,
          בהתאם לחוק הגנת הפרטיות, התשמ&quot;א-1981, ותקנות הגנת הפרטיות (אבטחת מידע), התשע&quot;ז-2017.
        </p>
      </div>

      {/* 1. Data Controller */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. בעל המאגר ופרטי התקשרות</h2>
        <p style={textStyle}>
          המידע נאסף ומנוהל על ידי Wedding Singles.
          לכל שאלה, בירור או מימוש זכויות בנושא פרטיות, ניתן לפנות אלינו:
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={emailStyle}>privacy@weddingsingles.app</span>
        </p>
      </div>

      {/* 2. What we collect */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. המידע שאנו אוספים</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>סוג מידע</th>
              <th style={thStyle}>פירוט</th>
              <th style={thStyle}>מטרה</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>פרטי פרופיל</td>
              <td style={tdStyle}>שם תצוגה, גיל, מגדר, העדפת שיוך, ביוגרפיה, עיר</td>
              <td style={tdStyle}>הצגת פרופיל למשתמשים אחרים באירוע</td>
            </tr>
            <tr>
              <td style={tdStyle}>תמונות</td>
              <td style={tdStyle}>עד 10 תמונות פרופיל, תמונות שנשלחו בצ&apos;אט</td>
              <td style={tdStyle}>הצגת פרופיל ותקשורת בין משתמשים</td>
            </tr>
            <tr>
              <td style={tdStyle}>תוכן משתמש</td>
              <td style={tdStyle}>הודעות טקסט, הודעות קוליות, לייקים</td>
              <td style={tdStyle}>אינטראקציה בין משתתפי האירוע</td>
            </tr>
            <tr>
              <td style={tdStyle}>נתוני מיקום</td>
              <td style={tdStyle}>קואורדינטות GPS (קו רוחב / אורך, דיוק)</td>
              <td style={tdStyle}>תכונת &quot;מצפן מפגש&quot; בלבד — בהסכמה מפורשת</td>
            </tr>
            <tr>
              <td style={tdStyle}>נתוני חיישנים</td>
              <td style={tdStyle}>כיוון מכשיר (Device Orientation / Motion)</td>
              <td style={tdStyle}>חישוב כיוון החץ במצפן בלבד</td>
            </tr>
            <tr>
              <td style={tdStyle}>מזהה מכשיר</td>
              <td style={tdStyle}>טביעת אצבע אנונימית (fingerprint) — אינה מזהה אישית</td>
              <td style={tdStyle}>מניעת הצטרפות כפולה לאירוע</td>
            </tr>
            <tr>
              <td style={tdStyle}>עוגיות (Cookies)</td>
              <td style={tdStyle}>עוגיית אימות httpOnly מאובטחת</td>
              <td style={tdStyle}>ניהול התחברות ואבטחת חשבון</td>
            </tr>
            <tr>
              <td style={tdStyle}>אחסון מקומי</td>
              <td style={tdStyle}>נתוני סשן באחסון המקומי של הדפדפן</td>
              <td style={tdStyle}>תאימות לאחור ושמירת מצב התחברות</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. Permissions */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. הרשאות מכשיר</h2>
        <p style={textStyle}>האפליקציה עשויה לבקש את ההרשאות הבאות. כל הרשאה ניתנת על ידכם מרצון וניתנת לביטול בכל עת דרך הגדרות המכשיר:</p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>מצלמה / גלריה</strong> — לצורך העלאת תמונות פרופיל ושליחת תמונות בצ&apos;אט.</li>
          <li style={liStyle}><strong>מיקרופון</strong> — לצורך הקלטת הודעות קוליות בצ&apos;אט.</li>
          <li style={liStyle}><strong>מיקום (GPS)</strong> — לצורך תכונת &quot;מצפן מפגש&quot; בלבד. נתוני המיקום נשלחים רק כאשר תכונת המצפן פעילה, ונמחקים מיד עם סיום השימוש.</li>
          <li style={liStyle}><strong>חיישני תנועה וכיוון (Motion / Orientation)</strong> — לחישוב כיוון החץ במצפן. נתונים אלה מעובדים מקומית במכשיר בלבד.</li>
        </ul>
      </div>

      {/* 4. Legal basis */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. הבסיס החוקי לעיבוד</h2>
        <p style={textStyle}>
          אנו מעבדים מידע אישי על בסיס הסכמה מפורשת שלכם, הניתנת בעת ההרשמה לאירוע ובעת הפעלת תכונות הדורשות הרשאות נוספות.
          ניתן לבטל הסכמה בכל עת על ידי מחיקת החשבון דרך הגדרות הפרופיל, או על ידי פנייה אלינו.
        </p>
      </div>

      {/* 5. How we use data */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. שימוש במידע</h2>
        <p style={textStyle}>המידע שלכם משמש אך ורק למטרות הבאות:</p>
        <ul style={listStyle}>
          <li style={liStyle}>הפעלת השירות — הצגת פרופילים, מתן אפשרות לייק, צ&apos;אט ומצפן</li>
          <li style={liStyle}>מניעת שימוש לרעה — חסימה, סינון תוכן, מניעת הצטרפות כפולה</li>
          <li style={liStyle}>אבטחת מידע — אימות זהות, מניעת CSRF, הגבלת קצב גישה</li>
        </ul>
        <p style={{ ...textStyle, fontWeight: 600, marginTop: '14px' }}>
          איננו מוכרים, משכירים, משתפים או מעבירים מידע אישי לצדדים שלישיים כלשהם, לרבות למטרות שיווק או פרסום.
        </p>
      </div>

      {/* 6. Data storage */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. אחסון מידע ואבטחה</h2>
        <ul style={listStyle}>
          <li style={liStyle}>המידע מאוחסן בשרתי <strong>Supabase</strong> (מבוססי PostgreSQL) המנוהלים בתשתית ענן מאובטחת.</li>
          <li style={liStyle}>תמונות מאוחסנות ב-Supabase Storage עם הרשאות גישה מוגבלות.</li>
          <li style={liStyle}>כל התקשורת מוצפנת באמצעות TLS/HTTPS.</li>
          <li style={liStyle}>סיסמאות אדמין מוצפנות באמצעות Bcrypt.</li>
          <li style={liStyle}>עוגיות אימות הן httpOnly, Secure, SameSite=Strict — אינן נגישות ל-JavaScript בצד הלקוח.</li>
          <li style={liStyle}>אנו מיישמים הגנה מפני CSRF, Rate Limiting, וסניטציה של קלט משתמש.</li>
        </ul>
      </div>

      {/* 7. Data retention */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. תקופת שמירה ומחיקת מידע</h2>
        <ul style={listStyle}>
          <li style={liStyle}><strong>מחיקה אוטומטית:</strong> כל מידע הקשור לאירוע (פרופילים, תמונות, הודעות, לייקים, חסימות) נמחק אוטומטית <strong>תוך 7 ימים</strong> מסיום האירוע.</li>
          <li style={liStyle}><strong>מחיקה עצמית:</strong> ניתן למחוק את החשבון והמידע בכל עת דרך הגדרות הפרופיל באפליקציה.</li>
          <li style={liStyle}><strong>נתוני מיקום:</strong> נמחקים מיידית עם סיום שימוש בתכונת המצפן — אינם נשמרים לאחר מכן.</li>
          <li style={liStyle}><strong>נתוני חיישנים:</strong> מעובדים מקומית במכשיר בלבד ואינם נשמרים בשרתים.</li>
        </ul>
      </div>

      {/* 8. Third parties */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. צדדים שלישיים</h2>
        <p style={textStyle}>אנו משתמשים בשירותי צד שלישי אך ורק לתשתית טכנית:</p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>Supabase</strong> — אחסון מסד נתונים, תמונות, ותקשורת בזמן אמת (Realtime).</li>
          <li style={liStyle}><strong>Vercel</strong> — אירוח האפליקציה ושרתי Edge.</li>
        </ul>
        <p style={textStyle}>
          אין לנו שירותי אנליטיקס, פרסום, מעקב, רשתות חברתיות, או כל SDK צד שלישי אחר.
        </p>
      </div>

      {/* 9. User rights */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. זכויות המשתמש</h2>
        <p style={textStyle}>
          בהתאם לחוק הגנת הפרטיות הישראלי, עומדות לכם הזכויות הבאות ביחס למידע האישי שלכם:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>זכות עיון:</strong> הזכות לעיין במידע שנאסף אודותיכם.</li>
          <li style={liStyle}><strong>זכות תיקון:</strong> הזכות לתקן מידע שגוי או לא מעודכן (דרך עריכת הפרופיל).</li>
          <li style={liStyle}><strong>זכות מחיקה:</strong> הזכות לדרוש מחיקה מלאה של כל המידע (דרך מחיקת חשבון או פנייה אלינו).</li>
          <li style={liStyle}><strong>זכות הסכמה וביטול:</strong> הזכות לבטל הסכמה לעיבוד מידע בכל עת.</li>
          <li style={liStyle}><strong>זכות הגבלה:</strong> הזכות לדרוש הגבלת עיבוד המידע.</li>
        </ul>
        <p style={textStyle}>
          למימוש זכויותיכם, פנו אלינו בדוא&quot;ל: <span style={emailStyle}>privacy@weddingsingles.app</span>
        </p>
      </div>

      {/* 10. Minors */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>10. קטינים</h2>
        <p style={textStyle}>
          השירות מיועד לבגירים בני 18 ומעלה בלבד. איננו אוספים ביודעין מידע מקטינים.
          אם נודע לנו כי נרשם קטין, נמחק את כל המידע הקשור אליו לאלתר.
        </p>
      </div>

      {/* 11. International transfers */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>11. העברת מידע מחוץ לישראל</h2>
        <p style={textStyle}>
          שרתי Supabase ו-Vercel עשויים להימצא מחוץ לישראל. העברת מידע מתבצעת בהתאם
          לתקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס&quot;א-2001,
          ובכפוף לאמצעי אבטחה מתאימים.
        </p>
      </div>

      {/* 12. Changes */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>12. שינויים במדיניות</h2>
        <p style={textStyle}>
          אנו שומרים את הזכות לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באפליקציה.
          המשך השימוש לאחר עדכון מהווה הסכמה למדיניות המעודכנת.
          מומלץ לעיין במדיניות מדי פעם.
        </p>
      </div>

      {/* 13. Contact */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>13. יצירת קשר</h2>
        <p style={textStyle}>
          לכל שאלה, בקשה או תלונה בנושא פרטיות:
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={emailStyle}>privacy@weddingsingles.app</span>
        </p>
        <p style={{ ...textStyle, fontSize: '13px', color: '#888', marginTop: '20px' }}>
          לתלונות בנושא פרטיות, ניתן לפנות גם לרשות להגנת הפרטיות — רשם מאגרי מידע, משרד המשפטים.
        </p>
      </div>

    </LegalPageLayout>
  );
}
