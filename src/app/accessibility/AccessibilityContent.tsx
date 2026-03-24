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
          במסגרת הנגשת האתר ביצענו את הפעולות הבאות:
        </LegalText>
        <LegalList>
          <li>
            <strong>טקסט חלופי</strong> - כל התמונות והסמלים באתר מכילים תיאורים חלופיים (alt)
            המאפשרים לקוראי מסך להציג את תוכנם. תמונות דקורטיביות מסומנות
            עם alt ריק כדי שקוראי מסך ידלגו עליהן.
          </li>
          <li>
            <strong>ניגודיות צבעים</strong> - יחס הניגודיות עומד ביחס מינימלי של 4.5:1 לטקסט רגיל
            ו-3:1 לטקסט גדול, בהתאם לדרישות התקן. צבע הרקע (#0A0A0A) מול
            צבע הטקסט (#F0EDE8) מספק יחס של כ-17.5:1.
          </li>
          <li>
            <strong>ניווט מקלדת</strong> - ניתן לנווט באתר באופן מלא באמצעות מקלדת בלבד
            (Tab, Enter, Space, Escape), כולל כל הכפתורים, כרטיסים, טפסים ודיאלוגים.
          </li>
          <li>
            <strong>מבנה סמנטי</strong> - האתר בנוי בהתאם לתקנים עם אזורי דף מוגדרים
            (header, nav, main, footer), כותרות היררכיות (H1–H6), טבלאות HTML סמנטיות
            עם scope בכותרות, ותיוג ARIA מתאים.
          </li>
          <li>
            <strong>תמיכה בקוראי מסך</strong> - כל הכפתורים, שדות הטפסים והדיאלוגים
            מתויגים עם aria-label, aria-describedby ו-role מתאימים.
            שגיאות מוכרזות באמצעות role=&quot;alert&quot;, והודעות סטטוס
            באמצעות role=&quot;status&quot;.
          </li>
          <li>
            <strong>פוקוס ויזואלי</strong> - כל אלמנט אינטראקטיבי מציג מסגרת פוקוס ברורה
            (2px solid) בעת ניווט עם מקלדת, באמצעות :focus-visible.
          </li>
          <li>
            <strong>דילוג לתוכן</strong> - קישור &quot;דלג לתוכן&quot; מופיע בתחילת כל דף
            בעת לחיצה על Tab, ומקפיץ ישירות לתוכן הראשי (#main-content).
          </li>
          <li>
            <strong>טפסים נגישים</strong> - כל שדה טופס מקושר לתווית (label), שגיאות מסומנות
            באמצעות aria-invalid ומוכרזות לקוראי מסך באמצעות role=&quot;alert&quot;.
            שדות מקושרים לתיאור שגיאה באמצעות aria-describedby.
          </li>
          <li>
            <strong>הפחתת תנועה</strong> - האתר מכבד את הגדרת &quot;prefers-reduced-motion&quot;
            ומבטל אנימציות עבור משתמשים שביקשו זאת.
          </li>
          <li>
            <strong>זום</strong> - האתר ניתן להגדלה עד 200% ללא שבירת תצוגה,
            ואינו חוסם זום בהגדרות ה-viewport (ללא user-scalable=no
            וללא maximum-scale).
          </li>
          <li>
            <strong>התראות בזמן אמת</strong> - הודעות מערכת והתראות Toast מוכרזות
            באמצעות aria-live=&quot;polite&quot;. שגיאות רשת וסטטוס חיבור
            מוכרזים באמצעות aria-live=&quot;assertive&quot; לקוראי מסך.
          </li>
          <li>
            <strong>דיאלוגים</strong> - כל חלון מודלי מסומן כ-dialog עם aria-modal,
            כולל נעילת פוקוס (focus trap) ותמיכה בסגירה עם Escape.
            בעת סגירה, הפוקוס חוזר לאלמנט שפתח את הדיאלוג.
          </li>
          <li>
            <strong>שפה וכיווניות</strong> - האתר מוגדר עם lang=&quot;he&quot;
            ו-dir=&quot;rtl&quot; לתמיכה מלאה בעברית מימין לשמאל. שדות טלפון
            ותוכן LTR מסומנים בכיווניות מתאימה.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="התקן שלפיו הונגש האתר">
        <LegalText>
          האתר הונגש בהתאם לתקן הישראלי ת&quot;י 5568, המבוסס על הנחיות WCAG 2.1 ברמת AA
          (Web Content Accessibility Guidelines).
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
          בכל שאלה, בקשה או דיווח על ליקוי נגישות ניתן לפנות אלינו:
        </LegalText>
        <LegalList>
          <li>
            דוא&quot;ל: <LegalLink href="mailto:contact@eventa.productions">contact@eventa.productions</LegalLink>
          </li>
        </LegalList>
        <LegalText>
          אנו מתחייבים לטפל בכל פנייה בנושא נגישות תוך 14 ימי עסקים.
        </LegalText>
      </LegalSection>

      <LegalSection title="תאריך עדכון ההצהרה">
        <LegalText>
          הצהרת נגישות זו עודכנה לאחרונה בתאריך: מרץ 2026.
        </LegalText>
      </LegalSection>
    </>
  );
}
