'use client';

/* Shared inline styles - matches other legal pages */
const sectionStyle: React.CSSProperties = { marginBottom: '36px' };
const headingStyle: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: '#d4a59a',
  marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
};
const textStyle: React.CSSProperties = { color: '#ccc', fontSize: '15px', lineHeight: 1.8, margin: '0 0 10px' };
const listStyle: React.CSSProperties = { ...textStyle, paddingRight: '20px', listStyleType: 'disc' };
const liStyle: React.CSSProperties = { marginBottom: '8px' };
const linkColor: React.CSSProperties = { color: '#d4a59a', fontWeight: 500, textDecoration: 'none' };

export default function AccessibilityContent() {
  return (
    <>
      {/* מבוא */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>מחויבות לנגישות</h2>
        <p style={textStyle}>
          Eventa מחויבת להנגשת השירות לאנשים עם מוגבלויות,
          בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע&quot;ג-2013,
          ובהתאם לתקן הישראלי ת&quot;י 5568 המבוסס על הנחיות WCAG 2.1 ברמה AA.
        </p>
      </div>

      {/* מה עשינו */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>אמצעי הנגישות באתר</h2>
        <p style={textStyle}>
          במסגרת הנגשת האתר ביצענו את הפעולות הבאות:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>
            <strong>טקסט חלופי</strong> - כל התמונות והסמלים באתר מכילים תיאורים חלופיים (alt)
            המאפשרים לקוראי מסך להציג את תוכנם.
          </li>
          <li style={liStyle}>
            <strong>ניגודיות צבעים</strong> - יחס הניגודיות עומד ביחס מינימלי של 4.5:1 לטקסט רגיל
            ו-3:1 לטקסט גדול, בהתאם לדרישות התקן.
          </li>
          <li style={liStyle}>
            <strong>ניווט מקלדת</strong> - ניתן לנווט באתר באופן מלא באמצעות מקלדת בלבד
            (Tab, Enter, Space, Escape), כולל כל הכפתורים, כרטיסים, טפסים ודיאלוגים.
          </li>
          <li style={liStyle}>
            <strong>מבנה סמנטי</strong> - האתר בנוי בהתאם לתקנים עם אזורי דף מוגדרים
            (header, nav, main, footer), כותרות היררכיות (H1–H6), ותיוג ARIA מתאים.
          </li>
          <li style={liStyle}>
            <strong>תמיכה בקוראי מסך</strong> - כל הכפתורים, שדות הטפסים והדיאלוגים
            מתויגים עם aria-label, aria-describedby ו-role מתאימים.
          </li>
          <li style={liStyle}>
            <strong>פוקוס ויזואלי</strong> - כל אלמנט אינטראקטיבי מציג מסגרת פוקוס ברורה
            בעת ניווט עם מקלדת.
          </li>
          <li style={liStyle}>
            <strong>דילוג לתוכן</strong> - קישור &quot;דלג לתוכן&quot; מופיע בתחילת כל דף
            בעת לחיצה על Tab.
          </li>
          <li style={liStyle}>
            <strong>טפסים נגישים</strong> - כל שדה טופס מקושר לתווית (label), שגיאות מסומנות
            באמצעות aria-invalid ומוכרזות לקוראי מסך באמצעות role=&quot;alert&quot;.
          </li>
          <li style={liStyle}>
            <strong>הפחתת תנועה</strong> - האתר מכבד את הגדרת &quot;prefers-reduced-motion&quot;
            ומבטל אנימציות עבור משתמשים שביקשו זאת.
          </li>
          <li style={liStyle}>
            <strong>זום</strong> - האתר ניתן להגדלה עד 200% ללא שבירת תצוגה,
            ואינו חוסם זום בהגדרות ה-viewport.
          </li>
          <li style={liStyle}>
            <strong>התראות בזמן אמת</strong> - הודעות מערכת, שגיאות וסטטוס רשת
            מוכרזים באמצעות aria-live לקוראי מסך.
          </li>
          <li style={liStyle}>
            <strong>דיאלוגים</strong> - כל חלון מודלי מסומן כ-dialog עם aria-modal,
            כולל נעילת פוקוס (focus trap) ותמיכה בסגירה עם Escape.
          </li>
        </ul>
      </div>

      {/* תקן */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>התקן שלפיו הונגש האתר</h2>
        <p style={textStyle}>
          האתר הונגש בהתאם לתקן הישראלי ת&quot;י 5568, המבוסס על הנחיות WCAG 2.1 ברמת AA
          (Web Content Accessibility Guidelines).
        </p>
      </div>

      {/* מגבלות ידועות */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>מגבלות ידועות</h2>
        <p style={textStyle}>
          אנו עושים כמיטב יכולתנו להנגיש את כל חלקי האתר.
          עם זאת, ייתכנו רכיבים שטרם הונגשו באופן מלא.
          אם נתקלתם בבעיית נגישות - נשמח לשמוע ולתקן בהקדם.
        </p>
      </div>

      {/* פנייה */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>יצירת קשר בנושא נגישות</h2>
        <p style={textStyle}>
          בכל שאלה, בקשה או דיווח על ליקוי נגישות ניתן לפנות אלינו:
        </p>
        <ul style={listStyle}>
          <li style={liStyle}>
            דוא&quot;ל: <a href="mailto:contact@eventa.productions" style={linkColor}>contact@eventa.productions</a>
          </li>
        </ul>
        <p style={textStyle}>
          אנו מתחייבים לטפל בכל פנייה בנושא נגישות תוך 14 ימי עסקים.
        </p>
      </div>

      {/* תאריך */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h2 style={headingStyle}>תאריך עדכון ההצהרה</h2>
        <p style={textStyle}>
          הצהרת נגישות זו עודכנה לאחרונה בתאריך: פברואר 2026.
        </p>
      </div>
    </>
  );
}
