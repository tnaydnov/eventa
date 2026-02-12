import type { Metadata } from 'next';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'תנאי שימוש | Wedding Singles',
  description: 'תנאי השימוש של אפליקציית Wedding Singles — כללים, התחייבויות ומדיניות השירות.',
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
const emailStyle: React.CSSProperties = { color: '#d4a59a', fontWeight: 500 };

export default function TermsPage() {
  return (
    <LegalPageLayout title="תנאי שימוש" updatedAt="פברואר 2026">

      {/* Intro */}
      <div style={sectionStyle}>
        <p style={textStyle}>
          תנאי שימוש אלו (&quot;התנאים&quot;) מהווים הסכם מחייב ביניכם (&quot;המשתמש/ת&quot;) לבין
          <strong> Wedding Singles</strong> (&quot;אנחנו&quot;, &quot;השירות&quot;, &quot;האפליקציה&quot;).
          הם חלים על כל שימוש באפליקציה ומהווים את ההסכם המלא ביניכם לבינינו.
        </p>
      </div>

      {/* 1. Acceptance */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. קבלת התנאים</h2>
        <p style={textStyle}>
          בשימוש באפליקציה, לרבות כניסה לאירוע, יצירת פרופיל, שליחת הודעות או כל פעולה אחרת —
          את/ה מסכים/ה ומאשר/ת את תנאי שימוש אלו ואת <a href="/privacy" style={emailStyle}>מדיניות הפרטיות</a> שלנו.
          אם אינך מסכים/ה, הימנע/י משימוש באפליקציה.
        </p>
      </div>

      {/* 2. Eligibility */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. כשירות שימוש</h2>
        <ul style={listStyle}>
          <li style={liStyle}>השירות מיועד <strong>לבגירים בני 18 ומעלה בלבד</strong>.</li>
          <li style={liStyle}>הכניסה לאירוע מותנית בקבלת <strong>קוד כניסה ייחודי</strong> למשתתפים באירוע.</li>
          <li style={liStyle}>כל משתמש/ת רשאי/ת ליצור חשבון אחד בלבד לכל אירוע.</li>
        </ul>
      </div>

      {/* 3. Service description */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. תיאור השירות</h2>
        <p style={textStyle}>
          האפליקציה מאפשרת למשתתפי אירועי חתונה ליצור קשרים באמצעות:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>פרופיל אישי עם תמונות ומידע בסיסי</li>
          <li style={liStyle}>צפייה בפרופילים של משתתפים אחרים</li>
          <li style={liStyle}>שליחת לייקים וצ&apos;אט (טקסט, תמונות, הודעות קוליות)</li>
          <li style={liStyle}>תכונת &quot;מצפן מפגש&quot; לניווט למשתתף אחר (בהסכמה הדדית)</li>
        </ul>
        <p style={textStyle}>
          השירות <strong>זמני מטבעו</strong> — פעיל רק במהלך האירוע ותקופה קצרה לאחריו.
          כל המידע נמחק אוטומטית תוך 7 ימים מסיום האירוע.
        </p>
      </div>

      {/* 4. Device permissions */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. הרשאות מכשיר</h2>
        <p style={textStyle}>חלק מתכונות האפליקציה דורשות הרשאות מכשיר:</p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>מצלמה / גלריה:</strong> העלאת תמונות (פרופיל וצ&apos;אט). ניתן להעלות מהגלריה בלבד ללא הרשאת מצלמה.</li>
          <li style={liStyle}><strong>מיקרופון:</strong> הקלטת הודעות קוליות בצ&apos;אט. אופציונלי לחלוטין.</li>
          <li style={liStyle}><strong>מיקום (GPS):</strong> תכונת המצפן בלבד, בהסכמה מפורשת ובכל פעם מחדש.</li>
          <li style={liStyle}><strong>חיישני תנועה:</strong> חישוב כיוון מצפן. מעובדים מקומית ואינם נשלחים לשרת.</li>
        </ul>
        <p style={textStyle}>
          כל ההרשאות ניתנות מרצון, ניתן לבטלן בכל עת דרך הגדרות המכשיר. סירוב לתת הרשאה ימנע שימוש בתכונה הספציפית בלבד.
        </p>
      </div>

      {/* 5. User conduct */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. כללי התנהגות</h2>
        <p style={textStyle}>בשימוש באפליקציה, המשתמש/ת מתחייב/ת:</p>
        <ul style={listStyle}>
          <li style={liStyle}>להתנהג בכבוד ובנימוס כלפי משתמשים אחרים</li>
          <li style={liStyle}>לא להעלות תוכן פוגעני, מיני מפורש, מאיים, גזעני, או בלתי חוקי</li>
          <li style={liStyle}>לא להתחזות לאדם אחר או ליצור פרופיל מזויף</li>
          <li style={liStyle}>לא להטריד, לעקוב, או לפגוע במשתמשים אחרים</li>
          <li style={liStyle}>לא להשתמש באפליקציה למטרות מסחריות, פרסום, או ספאם</li>
          <li style={liStyle}>לא לנסות לחדור למערכות האפליקציה או לפגוע בשירות</li>
          <li style={liStyle}>לא לאסוף מידע על משתמשים אחרים ללא הסכמתם</li>
          <li style={liStyle}>להשתמש בתמונות אמיתיות של עצמכם בלבד</li>
        </ul>
      </div>

      {/* 6. Content */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. תוכן משתמשים</h2>
        <ul style={listStyle}>
          <li style={liStyle}>כל תוכן שמעלה המשתמש/ת (תמונות, טקסט, הודעות קוליות) הוא באחריותו/ה המלאה.</li>
          <li style={liStyle}>המשתמש/ת מצהיר/ה כי יש לו/ה את הזכות לפרסם את התוכן ושאינו מפר זכויות צד שלישי.</li>
          <li style={liStyle}>אנו שומרים את הזכות להסיר תוכן שמפר את תנאי השימוש, ללא התראה מוקדמת.</li>
          <li style={liStyle}>כל תוכן שהועלה נמחק אוטומטית עם מחיקת האירוע.</li>
        </ul>
      </div>

      {/* 7. Blocking & banning */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. חסימה וסילוק</h2>
        <ul style={listStyle}>
          <li style={liStyle}>כל משתמש/ת רשאי/ת <strong>לחסום</strong> משתמשים אחרים. חסימה מסתירה את שני הצדדים זה מזה.</li>
          <li style={liStyle}>מנהלי האירוע רשאים <strong>להרחיק (לבאן)</strong> משתתפים שמפרים את הכללים.</li>
          <li style={liStyle}>אנו שומרים את הזכות לחסום או למחוק חשבונות בגין הפרת תנאי שימוש, ללא הודעה מוקדמת.</li>
        </ul>
      </div>

      {/* 8. Intellectual property */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. קניין רוחני</h2>
        <p style={textStyle}>
          כל הזכויות באפליקציה, כולל עיצוב, קוד, לוגו, וסימני מסחר — שמורות ל-Wedding Singles.
          אין להעתיק, לשכפל, לפרסם, או להפיץ חלק כלשהו מהאפליקציה ללא אישור מפורש בכתב.
        </p>
      </div>

      {/* 9. Availability */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. זמינות השירות</h2>
        <p style={textStyle}>
          אנו עושים מאמץ לספק שירות רציף ויציב, אך איננו מתחייבים לזמינות 100%.
          השירות עלול להיות מושבת זמנית לצורך תחזוקה, עדכונים, או מסיבות שאינן בשליטתנו.
          לא תהיה לכם כל טענה או תביעה בגין חוסר זמינות זמני.
        </p>
      </div>

      {/* 10. Limitation of liability */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>10. הגבלת אחריות</h2>
        <p style={textStyle}>
          השירות מסופק <strong>&quot;כמות שהוא&quot; (AS IS)</strong> וללא כל מצג או התחייבות, מפורשים או משתמעים.
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>איננו אחראים לכל נזק ישיר, עקיף, תוצאתי או מיוחד הנובע משימוש באפליקציה.</li>
          <li style={liStyle}>איננו אחראים לקשרים, מפגשים או אינטראקציות שנוצרו דרך האפליקציה.</li>
          <li style={liStyle}>איננו אחראים לתוכן שמעלים משתמשים אחרים.</li>
          <li style={liStyle}>איננו אחראים לאובדן מידע, למעט כמפורט במדיניות הפרטיות.</li>
          <li style={liStyle}>המשתמש/ת לוקח/ת על עצמו/ה את מלוא האחריות לפעולותיו/ה ולמפגשים שנוצרים דרך האפליקציה.</li>
        </ul>
      </div>

      {/* 11. Indemnification */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>11. שיפוי</h2>
        <p style={textStyle}>
          המשתמש/ת מתחייב/ת לשפות ולפצות את Wedding Singles, עובדיה ונציגיה,
          בגין כל נזק, הפסד, תביעה או הוצאה (לרבות שכ&quot;ט עו&quot;ד) הנובעים מהפרת תנאי שימוש אלו
          או משימוש בלתי חוקי באפליקציה.
        </p>
      </div>

      {/* 12. Data deletion */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>12. מחיקת מידע וסיום שימוש</h2>
        <ul style={listStyle}>
          <li style={liStyle}>ניתן למחוק את החשבון בכל עת דרך הגדרות הפרופיל. המחיקה היא מלאה ובלתי הפיכה.</li>
          <li style={liStyle}>כל מידע הקשור לאירוע נמחק אוטומטית תוך 7 ימים מסיום האירוע.</li>
          <li style={liStyle}>אנו שומרים את הזכות לסיים את חשבונכם בכל עת בגין הפרת תנאי שימוש.</li>
        </ul>
      </div>

      {/* 13. Governing law */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>13. דין חל וסמכות שיפוט</h2>
        <p style={textStyle}>
          על תנאים אלו יחולו דיני מדינת ישראל בלבד.
          סמכות השיפוט הבלעדית לכל סכסוך הנובע מתנאים אלו או מהשימוש באפליקציה
          תהיה נתונה לבתי המשפט המוסמכים במחוז תל אביב-יפו.
        </p>
      </div>

      {/* 14. Changes */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>14. שינויים בתנאים</h2>
        <p style={textStyle}>
          אנו שומרים את הזכות לעדכן תנאים אלו מעת לעת.
          שינויים מהותיים ייכנסו לתוקף עם פרסומם באפליקציה.
          המשך שימוש לאחר עדכון מהווה הסכמה לתנאים המעודכנים.
        </p>
      </div>

      {/* 15. Contact */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>15. יצירת קשר</h2>
        <p style={textStyle}>
          לכל שאלה בנושא תנאי השימוש:
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={emailStyle}>support@weddingsingles.app</span>
        </p>
      </div>

    </LegalPageLayout>
  );
}
