import { LegalSection, LegalSubheading, LegalText, LegalList, LegalLink } from '@/components/legal';

export default function PrivacyContent() {
  return (
    <>
      <LegalSection title="מבוא והגדרות">
        <LegalText>
          מדיניות פרטיות זו מפרטת כיצד מפעיל השירות של <strong>Eventa</strong> (&quot;המפעיל&quot;, &quot;אנחנו&quot;, &quot;השירות&quot;)
          אוסף, משתמש, מאחסן ומוחק מידע בעת שימוש באפליקציה.
        </LegalText>
        <LegalText>
          השירות מיועד לשימוש במהלך אירועים ומאפשר יצירת קשרים בין משתתפים באותו אירוע.
        </LegalText>
        <LegalText>
          אנו פועלים לנקוט אמצעי אבטחה סבירים ולפעול בהתאם לדינים החלים עלינו.
          אם אינך מסכים/ה למדיניות זו, אנא הימנע/י משימוש בשירות.
        </LegalText>
      </LegalSection>

      <LegalSection title="1. מי מפעיל את השירות ופרטי קשר">
        <LegalText>
          השירות מופעל על-ידי מפעיל השירות (מפעיל פרטי).
          לשאלות או בקשות בנושא פרטיות ניתן לפנות באמצעי הקשר המוצגים בשירות.
        </LegalText>
        <LegalText>
          דוא&quot;ל: <LegalLink href="mailto:contact@eventa.productions">contact@eventa.productions</LegalLink>
        </LegalText>
        <LegalText>
          טלפון: <LegalLink href="tel:+972506449688">050-644-9688</LegalLink>
        </LegalText>
      </LegalSection>

      <LegalSection title="2. איזה מידע אנו אוספים">
        <LegalText>אנו אוספים/מעבדים מידע בהתאם לתכונות שבהן נעשה שימוש:</LegalText>

        <LegalSubheading>א. מספר טלפון נייד</LegalSubheading>
        <LegalText>
          מספר טלפון נייד ישראלי, משמש לאימות זהות באמצעות קוד SMS חד-פעמי (OTP)
          ולמניעת שימוש כפול. המספר נמחק אוטומטית תוך 7 ימים מסיום האירוע.
        </LegalText>

        <LegalSubheading>ב. מידע פרופיל (מסופק על-ידך)</LegalSubheading>
        <LegalText>
          שם תצוגה, גיל (דיווח עצמי), מגדר, למי את/ה נמשך/ת (נטייה/העדפה),
          &quot;מחפש/ת&quot;, עיר, ביוגרפיה, ותמונות פרופיל (עד כמות שמוגדרת בשירות).
        </LegalText>

        <LegalSubheading>ג. מידע תקשורת ותוכן</LegalSubheading>
        <LegalText>
          הודעות טקסט, תמונות בצ&apos;אט, התראות הקשורות ללייקים / הודעות.
        </LegalText>

        <LegalSubheading>ד. מידע התנהגות ותפעול</LegalSubheading>
        <LegalText>
          לייקים שנשלחו/התקבלו, התאמות / שיחות, חסימות, סטטוס פעילות
          (למשל עדכון &quot;נראה לאחרונה&quot;, ככל שמופעל בשירות).
        </LegalText>

        <LegalSubheading>ה. הסכמות והעדפות תקשורת</LegalSubheading>
        <LegalList>
          <li>הסכמה לקבלת הודעות SMS מהמערכת (אופציונלי, ניתן לשינוי בכל עת).</li>
          <li>הודעת תזכורת לפני האירוע, הודעת ברוכים הבאים, והודעת פידבק לאחר האירוע - עשויות להישלח למשתתפים שנתנו הסכמה לקבלת הודעות.</li>
        </LegalList>

        <LegalSubheading>ו. מזהים טכניים</LegalSubheading>
        <LegalList>
          <li>מזהה טכני / UUID הנשמר בדפדפן (למשל לצורך חיבור מחדש, מניעת שימוש כפול / עקיפת חסימות).</li>
          <li>פרטי אירוע / משתתף מתוך סשן (eventId, participantId וכו&apos;).</li>
        </LegalList>
        <LegalText>
          מזהים אלה עשויים להיחשב מזהים אישיים / מזהים טכניים, גם אם אינם כוללים שם אמיתי.
        </LegalText>
      </LegalSection>

      <LegalSection title="3. Cookies ואחסון מקומי (LocalStorage)">
        <LegalText>השירות משתמש באמצעים טכניים להפעלת התחברות ושמירת סשן:</LegalText>

        <LegalSubheading>עוגיות חיוניות (Functional / Strictly Necessary)</LegalSubheading>
        <LegalList>
          <li><strong>ws_session</strong> - עוגיית סשן לצורך התחברות והפעלת השירות (כוללת מזהי אירוע / משתתף).</li>
          <li><strong>ws_admin</strong> - עוגיית סשן לממשק אדמין.</li>
        </LegalList>
        <LegalText>
          העוגיות מוגדרות כעוגיות חיוניות, ואינן מיועדות לפרסום / מעקב / אנליטיקה.
          העוגיות מוגדרות עם מאפייני אבטחה (כגון HttpOnly, Secure בסביבת פרודקשן, SameSite בהתאם להגדרות השירות).
        </LegalText>

        <LegalSubheading>LocalStorage / אחסון דפדפן</LegalSubheading>
        <LegalText>ייתכן שנשמרים בדפדפן מפתחות טכניים כגון:</LegalText>
        <LegalList>
          <li>נתוני גיבוי סשן (לשחזור מצב התחברות)</li>
          <li>מזהה טכני אקראי (UUID)</li>
          <li>דגלים פנימיים (למשל &quot;הפרופיל הושלם&quot;)</li>
        </LegalList>
        <LegalText>
          באפשרותך למחוק נתונים אלה דרך הגדרות הדפדפן (&quot;ניקוי נתוני אתר&quot;).
        </LegalText>
      </LegalSection>

      <LegalSection title="4. מטרות העיבוד">
        <LegalText>אנו משתמשים במידע לצורך:</LegalText>
        <LegalList>
          <li>הפעלת השירות (פרופילים, לייקים, צ&apos;אט)</li>
          <li>אבטחה ומניעת שימוש לרעה (חסימות, בדיקות גישה, מניעת עקיפה, מניעת ספאם)</li>
          <li>תפעול ותחזוקה (איתור תקלות ושיפור יציבות)</li>
        </LegalList>
        <LegalText>בנוסף, ייתכן שימוש במידע לצורך:</LegalText>
        <LegalList>
          <li>שיפור השירות ותכונותיו</li>
          <li>בדיקות עומסים, ניטור תקלות ופיתוח עתידי</li>
          <li>זיהוי דפוסי שימוש מצטברים שאינם מזהים משתמשים</li>
        </LegalList>
        <LegalText bold>
          איננו מוכרים מידע אישי ואיננו משתפים מידע למטרות פרסום / שיווק.
        </LegalText>
      </LegalSection>

      <LegalSection title="5. בסיס לעיבוד">
        <LegalText>הבסיס לעיבוד הוא:</LegalText>
        <LegalList>
          <li>הסכמתך בעת שימוש בשירות</li>
          <li>הסכמה נפרדת לתכונות הדורשות הרשאות (כגון מצלמה / גלריה)</li>
          <li>אינטרס לגיטימי של המפעיל לאבטחת השירות, מניעת הונאה, ואכיפת תנאי השימוש</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. שיתוף מידע עם צדדים שלישיים">
        <LegalText>אנו משתמשים בספקי תשתית טכנית בלבד:</LegalText>
        <LegalList>
          <li><strong>Supabase</strong> - מסד נתונים, אחסון קבצים, תקשורת בזמן אמת</li>
          <li><strong>Vercel</strong> - אירוח והפצת האתר (CDN / Serverless)</li>
          <li><strong>ספק SMS (TextMe)</strong> - לצורך שליחת קוד אימות (OTP), תזכורות לפני אירוע, הודעות ברוכים הבאים ופידבק לאורחים. מספר הטלפון מועבר לספק לצורך השליחה בלבד.</li>
          <li><strong>Invoice4U</strong> - לצורך עיבוד תשלומים, הפקת חשבוניות וסליקה. פרטי תשלום מועברים ישירות לספק ואינם נשמרים בשרתי השירות.</li>
          <li><strong>שרת SMTP</strong> - לצורך שליחת דוא&quot;ל הזמנות ותקשורת תפעולית.</li>
        </LegalList>
        <LegalText bold>
          איננו משלבים נכון למועד זה שירותי אנליטיקה / פרסום (כגון Google Analytics, Mixpanel וכו&apos;).
        </LegalText>
      </LegalSection>

      <LegalSection title="7. אבטחת מידע">
        <LegalText>אנו נוקטים אמצעי אבטחה סבירים, לרבות:</LegalText>
        <LegalList>
          <li>תקשורת מוצפנת (HTTPS / TLS)</li>
          <li>שימוש בעוגיות HttpOnly ואבטחה מוגברת בסביבת פרודקשן</li>
          <li>הגנות נגד CSRF, Rate Limiting, וסניטציה לקלט</li>
          <li>בקרות גישה והרשאות</li>
        </LegalList>
        <LegalText>
          יחד עם זאת, אין מערכת חסינה לחלוטין, ולכן אין באפשרותנו להבטיח אבטחה מוחלטת.
        </LegalText>
      </LegalSection>

      <LegalSection title="8. שמירת מידע ומחיקה (Retention)">
        <LegalText>השירות נועד להיות זמני:</LegalText>
        <LegalList>
          <li>
            מידע אישי הקשור לאירוע (פרופילים, הודעות, תמונות, לייקים, חסימות)
            נמחק בדרך כלל <strong>בתוך עד 7 ימים</strong> מסיום האירוע.
          </li>
          <li>
            ייתכן עיכוב קצר במחיקה עקב גיבויים טכניים, תקלות, או צורך בהגנה מפני הונאה / עקיפה.
          </li>
          <li>
            נתונים מצטברים / סטטיסטיים שאינם מזהים משתמשים עשויים להישמר לצרכי תפעול / שיווק
            (למשל: מספר משתתפים, מספר לייקים), ללא פרטי משתמש מזהים.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="9. זכויות המשתמש/ת">
        <LegalText>בכפוף לדינים החלים, באפשרותך:</LegalText>
        <LegalList>
          <li>לעדכן פרטים בפרופיל</li>
          <li>למחוק חשבון (ככל שהאפשרות זמינה בשירות)</li>
          <li>לבקש עיון / תיקון / מחיקה / הגבלה דרך יצירת קשר עם המפעיל</li>
        </LegalList>
        <LegalText>
          <strong>לתשומת לב:</strong> מחיקה מן השירות הפעיל לא בהכרח מוחקת מיד גיבויים טכניים.
        </LegalText>
      </LegalSection>

      <LegalSection title="10. קטינים">
        <LegalText>
          השירות מיועד לבני 18+ בלבד. איננו אוספים ביודעין מידע מקטינים.
          אם יימצא חשד סביר לקטינות - ננקוט צעדים להסרה / חסימה / מחיקה.
        </LegalText>
      </LegalSection>

      <LegalSection title="11. העברת מידע מחוץ לישראל">
        <LegalText>
          חלק מספקי התשתית (למשל Supabase, Vercel) עשויים לאחסן ולעבד מידע מחוץ לישראל.
          העברת מידע זו מתבצעת בהתאם למנגנוני אבטחה מקובלים, לרבות שימוש בפרוטוקולי הצפנה ושרתי ענן מאובטחים.
        </LegalText>
      </LegalSection>

      <LegalSection title="12. שינויים במדיניות">
        <LegalText>
          מדיניות זו עשויה להתעדכן מעת לעת. השינויים יפורסמו בשירות.
          המשך שימוש לאחר פרסום שינוי מהווה הסכמה למדיניות המעודכנת.
        </LegalText>
      </LegalSection>

      <LegalSection title="13. יצירת קשר">
        <LegalText>
          לפניות פרטיות, שאלות או בקשות - השתמש/י באמצעי הקשר המופיעים בשירות.
        </LegalText>
        <LegalText>
          דוא&quot;ל: <LegalLink href="mailto:contact@eventa.productions">contact@eventa.productions</LegalLink>
        </LegalText>
        <LegalText>
          טלפון: <LegalLink href="tel:+972506449688">050-644-9688</LegalLink>
        </LegalText>
      </LegalSection>
    </>
  );
}
