/* ═══════════════════════════════════════════
   How-It-Works — Types & static data
   ═══════════════════════════════════════════ */

export type ScreenKey =
  | 'org-form'
  | 'org-pay'
  | 'org-poster'
  | 'org-sms'
  | 'org-place'
  | 'guest-scan'
  | 'guest-register'
  | 'guest-discover'
  | 'guest-match'
  | 'guest-chat'
  | 'guest-privacy';

export type Journey = 'organizer' | 'guest';

export type Step = {
  title: string;
  desc: string;
  /** Which phone screen mockup to show */
  screen: ScreenKey;
};

export const ORGANIZER_STEPS: Step[] = [
  {
    title: 'ממלאים טופס הזמנה',
    desc: 'בוחרים סוג אירוע, תאריך, רקע מותאם, ואם לשלוח הודעות לאורחים. הכל בטופס אחד פשוט.',
    screen: 'org-form',
  },
  {
    title: 'משלמים באופן מאובטח',
    desc: 'תשלום מיידי דרך האתר — כרטיס אשראי או BIT. ברגע שהתשלום עובר, אנחנו מתחילים לעבוד.',
    screen: 'org-pay',
  },
  {
    title: 'מקבלים פוסטר QR מעוצב',
    desc: 'תוך 48 שעות תקבלו למייל פוסטר מוכן להדפסה עם קוד QR וקישור — מותאם לסגנון האירוע שלכם.',
    screen: 'org-poster',
  },
  {
    title: 'שולחים הודעות לאורחים',
    desc: 'בחרתם לשלוח? העלו רשימת טלפונים ואנחנו שולחים הודעה עם קישור הצטרפות. לא בחרתם? הפוסטר עושה את העבודה.',
    screen: 'org-sms',
  },
  {
    title: 'מציבים את הפוסטר באירוע',
    desc: 'בכניסה, על הבר, על מסך — אתם בוחרים. האורחים סורקים ומצטרפים תוך שניות. הכל מוכן.',
    screen: 'org-place',
  },
];

export const GUEST_STEPS: Step[] = [
  {
    title: 'רואים את הפוסטר',
    desc: 'מגיעים לאירוע, רואים פוסטר מעוצב עם קוד QR. סורקים עם המצלמה או לוחצים על קישור — בלי להוריד שום אפליקציה.',
    screen: 'guest-scan',
  },
  {
    title: 'נרשמים תוך דקה',
    desc: 'אימות מהיר עם SMS, בוחרים תמונה, שם, גיל ומשפט קצר. הפרופיל מוכן — ואתם בפנים.',
    screen: 'guest-register',
  },
  {
    title: 'מגלים מי פה',
    desc: 'רואים את כל הרווקים והרווקות באירוע. גוללים בגריד, עוברים על פרופילים, מוצאים מישהו שתופס את העין.',
    screen: 'guest-discover',
  },
  {
    title: 'עושים לייק ומקבלים מאצ\'',
    desc: 'לחצתם על הלב? אם גם הצד השני לחץ — יש מאצ\'! הכל אנונימי עד שזה הדדי. בלי מבוכה.',
    screen: 'guest-match',
  },
  {
    title: 'שולחים הודעה ונפגשים',
    desc: 'אחרי מאצ\' נפתח צ\'אט פרטי. שלחו הודעה, תאמו מפגש — הם ממש שם, באותו אירוע.',
    screen: 'guest-chat',
  },
  {
    title: 'הכל נמחק. פרטיות מלאה.',
    desc: '7 ימים אחרי האירוע כל המידע נמחק אוטומטית. בלי מעקב, בלי פרסומות, בלי עקבות. רק הרגע.',
    screen: 'guest-privacy',
  },
];

export type GridUser = { name: string; age: number; photo: string };

export const GRID_USERS: GridUser[] = [
  { name: 'נועה', age: 24, photo: '/demo/noa.jpg' },
  { name: 'איתי', age: 27, photo: '/demo/itay.jpg' },
  { name: 'מאיה', age: 25, photo: '/demo/maya.jpg' },
  { name: 'דניאל', age: 28, photo: '/demo/daniel.jpg' },
  { name: 'שיר', age: 23, photo: '/demo/shir.jpg' },
  { name: 'עומר', age: 26, photo: '/demo/omer.jpg' },
  { name: 'תמר', age: 25, photo: '/demo/tamar.jpg' },
  { name: 'יונתן', age: 29, photo: '/demo/yonatan.jpg' },
  { name: 'ליאור', age: 24, photo: '/demo/lior.jpg' },
];
