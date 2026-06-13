import { LegalSection, LegalText } from '@/components/legal';

const thCls = 'text-right p-2.5 px-3 border-b border-white/12 text-[var(--primary)] font-semibold text-[0.8125rem]';
const tdCls = 'text-right p-2.5 px-3 border-b border-white/[0.06] text-[#bbb] text-sm align-top';

export default function CookiesContent() {
  return (
    <>
      <LegalSection title="מבוא">
        <LegalText>
          מדיניות עוגיות זו חלה על שירות Eventa, המופעל על-ידי תומר ניידנוב, עוסק פטור, הפועל תחת השם המסחרי Eventa.
        </LegalText>
        <LegalText>
          השירות משתמש ב<strong>עוגיות חיוניות</strong> להפעלת התחברות ואבטחת סשן.
          איננו משתמשים בעוגיות פרסום או מעקב.
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
          העוגיות הן פונקציונליות ונדרשות להפעלת השירות. ניתן למחוק עוגיות דרך הגדרות הדפדפן,
          אך ייתכן שחלק מהשירות לא יעבוד לאחר מכן.
        </LegalText>
        <LegalText bold>
          Eventa אינה משתמשת בעוגיות לצרכי פרסום, מעקב, או אנליטיקה.
        </LegalText>
      </LegalSection>
    </>
  );
}
