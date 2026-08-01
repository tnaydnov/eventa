import { LegalSection, LegalText } from '@/components/legal';
import { BRAND_NAME, LEGAL_OPERATOR } from '@/config/site';

const thCls = 'text-right p-2.5 px-3 border-b border-white/12 text-[var(--primary)] font-semibold text-[0.8125rem]';
const tdCls = 'text-right p-2.5 px-3 border-b border-white/[0.06] text-[#bbb] text-sm align-top';

export default function CookiesContent() {
  return (
    <>
      <LegalSection title="מבוא">
        <LegalText>
          מדיניות עוגיות זו חלה על שירות {BRAND_NAME}, המופעל על-ידי {LEGAL_OPERATOR}.
        </LegalText>
        <LegalText>
          השירות משתמש ב<strong>עוגיות חיוניות</strong> להפעלת התחברות ואבטחת סשן,
          וכן בעוגיות מדידה של Google Ads / Google Tag לצורך מדידת המרות ושיפור קמפיינים פרסומיים.
        </LegalText>
      </LegalSection>

      <LegalSection title="עוגיות עיקריות">
        <table className="w-full border-collapse text-sm mt-3">
          <thead>
            <tr>
              <th scope="col" className={thCls}>שם העוגייה</th>
              <th scope="col" className={thCls}>מטרה</th>
              <th scope="col" className={thCls}>משך</th>
              <th scope="col" className={thCls}>סוג</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdCls}><code className="text-[var(--primary)]">ws_session</code></td>
              <td className={tdCls}>התחברות ושמירת מצב סשן משתמש</td>
              <td className={tdCls}>30 יום</td>
              <td className={tdCls}>חיונית / פונקציונלית</td>
            </tr>
            <tr>
              <td className={tdCls}><code className="text-[var(--primary)]">ws_admin</code></td>
              <td className={tdCls}>גישה לממשק ניהול (אדמין)</td>
              <td className={tdCls}>24 שעות</td>
              <td className={tdCls}>חיונית / פונקציונלית</td>
            </tr>
            <tr>
              <td className={tdCls}><code className="text-[var(--primary)">_gcl_*</code></td>
              <td className={tdCls}>מדידה ואתריבוציה של המרות Google Ads</td>
              <td className={tdCls}>עד 90 ימים</td>
              <td className={tdCls}>מדידה / פרסום</td>
            </tr>
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="מאפייני אבטחה">
        <LegalText>
          כל העוגיות מוגדרות עם מאפייני אבטחה: <strong>HttpOnly</strong> (אינן נגישות ל-JavaScript),{' '}
          <strong>Secure</strong> (בסביבת פרודקשן), ו-<strong>SameSite</strong> (הגנה מפני CSRF).
        </LegalText>
      </LegalSection>

      <LegalSection title="אחסון מקומי (LocalStorage)">
        <LegalText>
          בנוסף לעוגיות, השירות עשוי להשתמש ב-LocalStorage או באמצעי אחסון דפדפן דומים
          לצורך שמירת מצב התחברות, מזהה טכני, שחזור סשן, שמירת טיוטת הודעה ודגלים פנימיים של השירות.
          מידע זה אינו משמש לפרסום או מעקב, וניתן למחיקה דרך הגדרות הדפדפן (&quot;ניקוי נתוני אתר&quot;).
        </LegalText>
      </LegalSection>

      <LegalSection title="ניהול עוגיות">
        <LegalText>
          העוגיות החיוניות נדרשות להפעלת השירות. העוגיות מסוג מדידה (כגון עוגיות Google Ads) משמשות
          למדידת המרות קמפיינים. ניתן למחוק עוגיות דרך הגדרות הדפדפן, אך חסימה של עוגיות חיוניות עלולה
          להשפיע על פעולה תקינה של השירות.
        </LegalText>
        <LegalText bold>
          Eventa משתמשת ב־Google Ads / Google Tag לצורך מדידת המרות ושיפור קמפיינים פרסומיים.
          איננו משתמשים בעוגיות לאנליטיקה כללית (Google Analytics) או מעקב מעבר לאתר.
        </LegalText>
      </LegalSection>
    </>
  );
}
