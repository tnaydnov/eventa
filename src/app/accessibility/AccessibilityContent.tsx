import { LegalSection, LegalText, LegalList, LegalLink } from '@/components/legal';

export default function AccessibilityContent() {
  return (
    <>
      <LegalSection title="מחויבות לנגישות">
        <LegalText>
          Eventa מחויבת להנגשת השירות לאנשים עם מוגבלויות,
          בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע&quot;ג-2013,
          ובהתאם לתקן הישראלי ת&quot;י 5568 המבוסס על הנחיות WCAG 2.1 ברמה AA.
        </LegalText>
      </LegalSection>

      <LegalSection title="אמצעי הנגישות באתר">
        <LegalText>
          האתר תוכנן ופותח במטרה לעמוד בדרישות הנגישות. במסגרת זאת בוצעו התאמות הכוללות, בין היתר:
        </LegalText>
        <LegalList>
          <li>
            <strong>טקסט חלופי</strong> - תמונות וסמלים משמעותיים באתר תוכננו עם תיאורים חלופיים (alt)
            המאפשרים לקוראי מסך להציג את תוכנם. תמונות דקורטיביות מסומנות
            עם alt ריק כדי שקוראי מסך ידלגו עליהן.
          </li>
          <li>
            <strong>ניגודיות צבעים</strong> - בוצעו התאמות ניגודיות במטרה לעמוד ביחס מינימלי של 4.5:1 לטקסט רגיל
            ו-3:1 לטקסט גדול. צבע הרקע (#0A0A0A) מול צבע הטקסט (#F0EDE8) מספק יחס גבוה מאוד.
          </li>
          <li>
            <strong>ניווט מקלדת</strong> - האתר תוכנן לתמוך בניווט באמצעות מקלדת
            (Tab, Enter, Space, Escape), לרבות כפתורים, כרטיסים, טפסים ודיאלוגים.
          </li>
          <li>
            <strong>מבנה סמנטי</strong> - האתר בנוי עם אזורי דף מוגדרים
            (header, nav, main, footer), כותרות היררכיות (H1–H6), טבלאות HTML סמנטיות
            עם scope בכותרות, ותיוג ARIA מתאים.
          </li>
          <li>
            <strong>תמיכה בקוראי מסך</strong> - כפתורים, שדות טופס ודיאלוגים
            תויגו עם aria-label, aria-describedby ו-role מתאימים.
            שגיאות מוכרזות באמצעות role=&quot;alert&quot;, והודעות סטטוס
            באמצעות role=&quot;status&quot;.
          </li>
          <li>
            <strong>פוקוס ויזואלי</strong> - אלמנטים אינטראקטיביים מציגים מסגרת פוקוס ברורה
            בעת ניווט עם מקלדת, באמצעות :focus-visible.
          </li>
          <li>
            <strong>דילוג לתוכן</strong> - קישור &quot;דלג לתוכן&quot; מופיע בתחילת דף
            בעת לחיצה על Tab, ומקפיץ ישירות לתוכן הראשי (#main-content).
          </li>
          <li>
            <strong>טפסים נגישים</strong> - שדות טופס מקושרים לתווית (label), שגיאות מסומנות
            באמצעות aria-invalid ומוכרזות לקוראי מסך באמצעות role=&quot;alert&quot;.
            שדות מקושרים לתיאור שגיאה באמצעות aria-describedby.
          </li>
          <li>
            <strong>הפחתת תנועה</strong> - האתר מכבד את הגדרת &quot;prefers-reduced-motion&quot;
            ומבטל אנימציות עבור משתמשים שביקשו זאת.
          </li>
          <li>
            <strong>זום</strong> - האתר תוכנן לאפשר הגדלה ללא חסימת זום בהגדרות ה-viewport
            (ללא user-scalable=no וללא maximum-scale).
          </li>
          <li>
            <strong>התראות בזמן אמת</strong> - הודעות מערכת והתראות Toast מוכרזות
            באמצעות aria-live=&quot;polite&quot;. שגיאות רשת וסטטוס חיבור
            מוכרזים באמצעות aria-live=&quot;assertive&quot; לקוראי מסך.
          </li>
          <li>
            <strong>דיאלוגים</strong> - חלונות מודליים מסומנים כ-dialog עם aria-modal,
            לרבות נעילת פוקוס (focus trap) ותמיכה בסגירה עם Escape.
            בעת סגירה, הפוקוס חוזר לאלמנט שפתח את הדיאלוג.
          </li>
          <li>
            <strong>שפה וכיווניות</strong> - האתר מוגדר עם lang=&quot;he&quot;
            ו-dir=&quot;rtl&quot; לתמיכה בעברית מימין לשמאל. שדות טלפון
            ותוכן LTR מסומנים בכיווניות מתאימה.
          </li>
        </LegalList>
        <LegalText>
          אנו ממשיכים לבדוק, לתקן ולשפר את הנגישות באתר ובשירות באופן מתמשך.
        </LegalText>
      </LegalSection>

      <LegalSection title="התקן שלפיו הונגש האתר">
        <LegalText>
          האתר תוכנן ופותח במטרה לעמוד בהנחיות הנגישות לפי התקן הישראלי ת&quot;י 5568,
          המבוסס על הנחיות WCAG 2.1 ברמת AA (Web Content Accessibility Guidelines).
        </LegalText>
      </LegalSection>

      <LegalSection title="מגבלות ידועות">
        <LegalText>
          אנו עושים כמיטב יכולתנו להנגיש את כל חלקי האתר.
          עם זאת, ייתכנו רכיבים שטרם הונגשו באופן מלא.
          אם נתקלתם בבעיית נגישות - נשמח לשמוע ולתקן בהקדם.
        </LegalText>
      </LegalSection>

      <LegalSection title="יצירת קשר בנושא נגישות">
        <LegalText>
          אחראי פניות נגישות: תומר ניידנוב, מטעם Eventa.
        </LegalText>
        <LegalText>
          בכל שאלה, בקשה או דיווח על ליקוי נגישות ניתן לפנות אלינו:
        </LegalText>
        <LegalList>
          <li>
            דוא&quot;ל: <LegalLink href="mailto:contact@eventa.productions">contact@eventa.productions</LegalLink>
          </li>
          <li>
            טלפון: <LegalLink href="tel:+972507165658">050-716-5658</LegalLink>
          </li>
        </LegalList>
        <LegalText>
          אנו מתחייבים לטפל בכל פנייה בנושא נגישות תוך 14 ימי עסקים.
        </LegalText>
      </LegalSection>

      <LegalSection title="תאריך עדכון ההצהרה">
        <LegalText>
          הצהרת נגישות זו עודכנה לאחרונה בתאריך: יוני 2026.
        </LegalText>
      </LegalSection>
    </>
  );
}
