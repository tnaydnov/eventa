'use client';

/* Shared inline styles */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const listStyle: React.CSSProperties = { ...textStyle, paddingRight: '20px', listStyleType: 'disc' };
const liStyle: React.CSSProperties = { marginBottom: '8px' };
const boldText: React.CSSProperties = { ...textStyle, fontWeight: 600, marginTop: '14px' };
const linkColor: React.CSSProperties = { color: '#d4a59a', fontWeight: 500, textDecoration: 'none' };

export default function TermsContent() {
  return (
    <>
      {/* מבוא */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>מבוא והגדרות</h2>
        <p style={textStyle}>
          תנאי שימוש אלה (&quot;התנאים&quot;) מהווים הסכם מחייב בינך (&quot;המשתמש/ת&quot;) לבין
          מפעיל השירות של <strong>Eventa</strong> (&quot;המפעיל&quot;, &quot;Eventa&quot;, &quot;השירות&quot;, &quot;האפליקציה&quot;).
        </p>
        <p style={textStyle}>
          השירות הוא פלטפורמה אינטרנטית זמנית לשימוש במהלך אירועים (למשל: חתונות, מסיבות, כנסים),
          המאפשרת יצירת פרופיל, צפייה בפרופילים, שליחת לייקים ופתיחת שיחות צ&apos;אט בין משתתפים באותו אירוע.
        </p>
        <p style={boldText}>
          בשימוש בשירות את/ה מאשר/ת כי קראת, הבנת והסכמת לתנאים אלה
          ול<a href="/privacy" style={linkColor}>מדיניות הפרטיות</a> של השירות.
        </p>
      </div>

      {/* 1 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. קבלת התנאים</h2>
        <p style={textStyle}>
          כניסה לשירות, יצירת פרופיל, העלאת תוכן, שליחת הודעות, שימוש בלייקים -
          כולם מהווים הסכמה לתנאים אלה ולמדיניות הפרטיות.
        </p>
        <p style={boldText}>אם אינך מסכים/ה לתנאים - אין להשתמש בשירות.</p>
      </div>

      {/* 2 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. כשירות וגיל מינימלי</h2>
        <ul style={listStyle}>
          <li style={liStyle}>השירות מיועד <strong>לבגירים בני 18 ומעלה בלבד</strong>.</li>
          <li style={liStyle}>אין למפעיל אמצעי אימות גיל מלאים. הגיל (אם מוזן) הוא דיווח עצמי.</li>
          <li style={liStyle}>
            אם קיים חשד סביר שמשתמש/ת הוא/היא קטין/ה, המפעיל רשאי לחסום את הגישה,
            להשעות או למחוק את החשבון והמידע הקשור אליו.
          </li>
        </ul>
      </div>

      {/* 3 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. גישה לאירוע באמצעות &quot;קוד כניסה&quot;</h2>
        <ul style={listStyle}>
          <li style={liStyle}>הגישה לשירות עבור אירוע מתבצעת באמצעות קוד כניסה / קישור / QR שנמסר למשתתפי האירוע.</li>
          <li style={liStyle}>המפעיל רשאי לשנות, לבטל או להחליף קוד כניסה, וכן להגביל גישה לפי שיקול דעתו (לרבות מניעת שימוש חוזר/מוגזם).</li>
          <li style={liStyle}>השירות מיועד לשימוש על-ידי משתתפי האירוע בלבד. אין להעביר קוד כניסה לאחרים שאינם משתתפים.</li>
        </ul>
      </div>

      {/* 4 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. תיאור השירות ותכונותיו</h2>
        <p style={textStyle}>השירות עשוי לכלול, בין היתר:</p>
        <ul style={listStyle}>
          <li style={liStyle}>יצירת פרופיל עם תמונות ומידע בסיסי (כפוף להגדרות האירוע)</li>
          <li style={liStyle}>צפייה בפרופילים של משתתפים אחרים באותו אירוע</li>
          <li style={liStyle}>שליחת לייקים</li>
          <li style={liStyle}>פתיחת שיחות צ&apos;אט (טקסט ותמונות - לפי מה שמופעל בשירות)</li>
        </ul>
        <p style={boldText}>
          השירות הוא זמני מטבעו ומיועד לשימוש במהלך האירוע ובתקופה מוגבלת לאחריו.
        </p>
      </div>

      {/* 5 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. הרשאות מכשיר</h2>
        <p style={textStyle}>חלק מהתכונות עשויות לבקש הרשאות:</p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>גלריה / מצלמה</strong> - לצורך העלאת תמונות לפרופיל ולצ&apos;אט.</li>
        </ul>
        <p style={textStyle}>
          ההרשאות הן מרצון וניתן לבטלן בכל עת בהגדרות המכשיר. סירוב לתת הרשאה ימנע שימוש בתכונה הספציפית בלבד.
        </p>
      </div>

      {/* 6 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. כללי התנהגות ותוכן אסור (אפס סובלנות)</h2>
        <p style={textStyle}>המשתמש/ת מתחייב/ת:</p>
        <ul style={listStyle}>
          <li style={liStyle}>להתנהג בכבוד ולא להטריד / לאיים / לעקוב / לפגוע</li>
          <li style={liStyle}>לא להעלות או לשלוח תוכן בלתי חוקי, מאיים, גזעני, שקרי, או פוגעני</li>
          <li style={liStyle}>לא להעלות תוכן מיני מפורש, תמונות עירום / פורנוגרפיה, או כל תוכן שאינו הולם לאירוע</li>
          <li style={liStyle}>לא להתחזות לאדם אחר, ולא ליצור פרופיל מטעה</li>
          <li style={liStyle}>לא לפרסם ספאם, פרסומות, או קידום עסקי ללא אישור</li>
          <li style={liStyle}>לא לנסות לעקוף חסימות, לבצע הנדסה לאחור, או לפגוע בתשתית השירות</li>
          <li style={liStyle}>לא לאסוף מידע על אחרים (כולל צילום / העתקה / הפצה) ללא רשותם</li>
        </ul>
        <p style={boldText}>
          חשוב: המפעיל אינו מבצע אימות זהות מלא, ולכן אין התחייבות שכל פרופיל הוא אמיתי או מדויק.
        </p>
      </div>

      {/* 7 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. תוכן משתמשים: זכויות, אחריות והסרה</h2>
        <ul style={listStyle}>
          <li style={liStyle}>כל תוכן שהמשתמש/ת מעלה או שולח/ת (טקסט, תמונות) הוא באחריותו/ה הבלעדית.</li>
          <li style={liStyle}>
            העלאת תוכן מהווה הצהרה כי יש למשתמש/ת זכות חוקית להעלות/לשתף את התוכן
            וכי התוכן אינו מפר זכויות צד ג&apos; (פרטיות, זכויות יוצרים, סימני מסחר וכו&apos;).
          </li>
          <li style={liStyle}>
            <strong>תמונות/סרטונים של אנשים אחרים:</strong> אין להעלות תוכן הכולל אנשים אחרים ללא הסכמתם,
            במיוחד אם מדובר בתמונה אינטימית / רגישה.
          </li>
          <li style={liStyle}>
            המפעיל רשאי (אך אינו חייב) להסיר/להסתיר תוכן, לחסום משתמשים, או להגביל תכונות,
            אם יש חשד להפרת תנאים אלה או דין.
          </li>
        </ul>
      </div>

      {/* 8 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. צילום מסך ושיתוף מחוץ לשירות</h2>
        <p style={textStyle}>
          השירות אינו יכול למנוע צילום מסך, צילום במסך אחר, או הפצה חיצונית על-ידי משתמשים. יחד עם זאת:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}><strong>חל איסור</strong> לשתף תכנים של אחרים מחוץ לשירות ללא הסכמתם.</li>
          <li style={liStyle}>כל שימוש לרעה בתוכן עלול להוות הפרה של תנאים אלה ושל הדין, והמשתמש/ת יישא/תישא באחריות מלאה.</li>
        </ul>
      </div>

      {/* 9 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. חסימה וטיפול בתוכן פוגעני</h2>
        <p style={textStyle}>
          השירות מאפשר חסימת משתמשים. חסימה מסתירה את הצדדים זה מזה ומונעת המשך תקשורת.
          לפניות נוספות בנושא הטרדה או תוכן פוגעני ניתן ליצור קשר עם המפעיל באמצעי הקשר המופיעים בשירות.
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>המפעיל רשאי, לפי שיקול דעתו, לבצע אחת או יותר מהפעולות: הסרת תוכן, חסימה זמנית/קבועה, השעיה, או מחיקת חשבון.</li>
          <li style={liStyle}>המפעיל אינו מתחייב לטיפול בזמן אמת או לתגובה מיידית, אך ישתדל לטפל בפניות בפרק זמן סביר.</li>
        </ul>
      </div>

      {/* 10 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>10. חסימה (Block), מחיקת שיחה והרחקה (Ban)</h2>
        <ul style={listStyle}>
          <li style={liStyle}>משתמש/ת יכול/ה לחסום משתמש/ת אחר/ת. חסימה מסתירה את הצדדים זה מזה, ומונעת המשך תקשורת.</li>
          <li style={liStyle}>חסימה עשויה למחוק / להסתיר את היסטוריית השיחה וההתראות בין הצדדים במסגרת השירות.</li>
          <li style={liStyle}>המפעיל רשאי להרחיק משתמשים (Ban) לפי שיקול דעתו, כולל חסימת מכשירים / מזהים טכניים, כדי למנוע שימוש לרעה או עקיפת חסימות.</li>
        </ul>
      </div>

      {/* 11 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>11. זמינות השירות</h2>
        <p style={textStyle}>
          המפעיל עושה מאמץ לספק שירות תקין, אך השירות מסופק <strong>&quot;כמות שהוא&quot; (AS IS)</strong> וללא
          התחייבות לזמינות רציפה, תמיכה בזמן אמת, או חוויית שימוש ללא תקלות - במיוחד בעומסים.
        </p>
        <p style={textStyle}>
          השירות הוא זמני מטבעו ואינו מבטיח שמירת מידע לצמיתות.
          ייתכן שמידע יימחק אוטומטית או עקב תחזוקה, תקלה או שינוי במערכת.
        </p>
      </div>

      {/* 12 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>12. קניין רוחני</h2>
        <p style={textStyle}>
          כל הזכויות בשירות, בקוד, בעיצוב, בשם Eventa ובתכנים שיצר המפעיל - שמורות למפעיל השירות.
          אין להעתיק, לשכפל, להפיץ או לבצע שימוש מסחרי בשירות או בחלקיו ללא אישור מראש ובכתב.
        </p>
      </div>

      {/* 13 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>13. הגבלת אחריות</h2>
        <p style={textStyle}>למעט חובה שאינה ניתנת להתניה לפי דין:</p>
        <ul style={listStyle}>
          <li style={liStyle}>המפעיל לא יישא באחריות לנזקים ישירים / עקיפים / תוצאתיים הנובעים משימוש בשירות.</li>
          <li style={liStyle}>המפעיל אינו אחראי לאינטראקציות, מפגשים או קשרים שנוצרו בין משתמשים.</li>
          <li style={liStyle}>המפעיל אינו אחראי לתוכן שמעלים משתמשים אחרים.</li>
          <li style={liStyle}>המשתמש/ת אחראי/ת לשיקול דעתו/ה ולבחירותיו/ה במהלך האירוע ולאחריו.</li>
        </ul>
      </div>

      {/* 14 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>14. שיפוי</h2>
        <p style={textStyle}>
          המשתמש/ת מתחייב/ת לשפות את מפעיל השירות בגין כל תביעה / נזק / הוצאה
          (כולל שכ&quot;ט עו&quot;ד) הנובעים מהפרת תנאים אלה, מהעלאת תוכן מפר, או משימוש בלתי חוקי בשירות.
        </p>
      </div>

      {/* 15 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>15. מחיקה, שמירה זמנית וגיבויים</h2>
        <ul style={listStyle}>
          <li style={liStyle}>ניתן למחוק חשבון דרך האפליקציה (ככל שתכונה זו זמינה). המחיקה תסיר את המידע מן השירות הפעיל.</li>
          <li style={liStyle}>מידע הקשור לאירוע נמחק באופן אוטומטי בדרך כלל <strong>בתוך עד 7 ימים</strong> מסיום האירוע.</li>
          <li style={liStyle}>ייתכן עיכוב קצר במחיקה עקב גיבויים טכניים, תקלות, או צורך באבטחה / מניעת הונאה.</li>
          <li style={liStyle}>
            נתונים טכניים מסוימים (למשל מזהי חסימה לצורך מניעת עקיפה) עשויים להישמר לתקופה מוגבלת
            גם לאחר מחיקת חשבון, ככל שהדבר נחוץ להגנה על השירות.
          </li>
        </ul>
      </div>

      {/* 16 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>16. שינויים בתנאים</h2>
        <p style={textStyle}>
          המפעיל רשאי לעדכן תנאים אלה מעת לעת. שינוי ייכנס לתוקף עם פרסומו בשירות.
          המשך שימוש לאחר שינוי מהווה הסכמה לתנאים המעודכנים.
        </p>
      </div>

      {/* 17 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>17. דין וסמכות שיפוט</h2>
        <p style={textStyle}>
          על תנאים אלה יחולו דיני מדינת ישראל.
          סמכות השיפוט הבלעדית תהיה לבתי המשפט המוסמכים במחוז תל אביב–יפו.
        </p>
      </div>

      {/* 18 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>18. יצירת קשר</h2>
        <p style={textStyle}>
          לשאלות בנוגע לתנאים או לשירות, ניתן לפנות למפעיל השירות באמצעי הקשר המופיעים בשירות.
        </p>
        <p style={textStyle}>
          דוא&quot;ל: <span style={linkColor}>contact@eventa.productions</span>
        </p>
      </div>

      {/* 19 */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>19. הצהרת נגישות</h2>
        <p style={textStyle}>
          אנו פועלים להנגיש את השירות בהתאם לתקנות הנגישות החלות בישראל
          (תקן 5568 מבוסס WCAG 2.0 AA), במידת סבירות ביחס לאופי השירות הזמני.
        </p>
        <p style={textStyle}>
          בכל שאלה, בקשה או דיווח על ליקוי נגישות ניתן לפנות אלינו
          בדוא&quot;ל: <span style={linkColor}>contact@eventa.productions</span>.
        </p>
      </div>

      {/* 20 */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>20. מדיניות ביטולים והחזרים</h2>
        <p style={textStyle}>
          השירות מסופק בתשלום חד-פעמי לאירוע.
          לביטול הזמנה יש לפנות למפעיל בדוא&quot;ל: <span style={linkColor}>contact@eventa.productions</span>.
          להלן מדיניות הביטול:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>
            <strong>ביטול עד 24 שעות לפני האירוע</strong> — ניתן לבטל ללא חיוב. יינתן החזר מלא.
          </li>
          <li style={liStyle}>
            <strong>ביטול בתוך 24 השעות שלפני האירוע</strong> — ייתכנו דמי ביטול בגובה 50% מהתשלום, בהתאם לשיקול דעת המפעיל.
          </li>
          <li style={liStyle}>
            <strong>לאחר תחילת האירוע</strong> — לא יינתן החזר כספי.
          </li>
          <li style={liStyle}>
            <strong>ביטול אירוע על-ידי המפעיל</strong> — במקרה שהמפעיל מבטל את השירות, יינתן החזר מלא.
          </li>
        </ul>
        <p style={textStyle}>
          ההחזר יבוצע באותו אמצעי תשלום בו שולם, תוך 14 ימי עסקים.
        </p>
      </div>
    </>
  );
}
