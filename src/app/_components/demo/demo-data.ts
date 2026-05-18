/* Demo fixture data for DemoPhone component */

type Gender = 'גבר' | 'אישה' | 'אחר';
type LookingFor = 'קשר רציני' | 'משהו קליל' | 'חברים/ות' | 'עוד לא יודע/ת';

export type DemoUser = {
  name: string;
  age: number;
  city: string;
  bio: string;
  gender: Gender;
  seed: string;
  photo: string;
  lookingFor: LookingFor;
};

export type DemoMsg = {
  id: number;
  text: string;
  type: 'text' | 'system';
  sent: boolean;
  time: string;
};

export const USERS: DemoUser[] = [
  { name: 'נועה', age: 24, city: 'תל אביב', bio: 'אוהבת ריקודים, מוזיקה וערבי יין 🍷', gender: 'אישה', seed: 'Noa24f', lookingFor: 'קשר רציני', photo: '/demo/noa.jpg' },
  { name: 'איתי', age: 27, city: 'הרצליה', bio: 'סרפר בשבתות, שף חובב בימי חול 🏄‍♂️', gender: 'גבר', seed: 'Itay27m', lookingFor: 'משהו קליל', photo: '/demo/itay.jpg' },
  { name: 'מאיה', age: 25, city: 'רמת גן', bio: 'מעצבת גרפית, חולמת בגדול 🎨', gender: 'אישה', seed: 'Maya25f', lookingFor: 'חברים/ות', photo: '/demo/maya.jpg' },
  { name: 'דניאל', age: 28, city: 'תל אביב', bio: 'מפתח תוכנה ואוהב טיולים בטבע 🌿', gender: 'גבר', seed: 'Daniel28m', lookingFor: 'קשר רציני', photo: '/demo/daniel.jpg' },
  { name: 'שיר', age: 23, city: 'חיפה', bio: 'סטודנטית לפסיכולוגיה, אוהבת חתולים 🐱', gender: 'אישה', seed: 'Shir23f', lookingFor: 'עוד לא יודע/ת', photo: '/demo/shir.jpg' },
  { name: 'עומר', age: 26, city: 'ראשון לציון', bio: 'מוזיקאי וצלם חובב 📸', gender: 'גבר', seed: 'Omer26m', lookingFor: 'משהו קליל', photo: '/demo/omer.jpg' },
  { name: 'תמר', age: 25, city: 'תל אביב', bio: 'עורכת דין ביום, יוגיסטית בלילה 🧘‍♀️', gender: 'אישה', seed: 'Tamar25f', lookingFor: 'קשר רציני', photo: '/demo/tamar.jpg' },
  { name: 'יונתן', age: 29, city: 'פתח תקווה', bio: 'מהנדס מזון, שוחרי אוכל טוב 🍕', gender: 'גבר', seed: 'Yonatan29m', lookingFor: 'חברים/ות', photo: '/demo/yonatan.jpg' },
  { name: 'ליאור', age: 24, city: 'גבעתיים', bio: 'רקדנית היפ-הופ, חיוכים 24/7 💃', gender: 'אישה', seed: 'Lior24f', lookingFor: 'משהו קליל', photo: '/demo/lior.jpg' },
  { name: 'רועי', age: 27, city: 'כפר סבא', bio: 'רואה חשבון עם תשוקה לקומדיות 😂', gender: 'גבר', seed: 'Roi27m', lookingFor: 'עוד לא יודע/ת', photo: '/demo/roi.jpg' },
  { name: 'אגם', age: 22, city: 'הוד השרון', bio: 'סטודנטית לאומנות, צמחונית גאה 🌻', gender: 'אישה', seed: 'Agam22f', lookingFor: 'חברים/ות', photo: '/demo/agam.jpg' },
  { name: 'אלון', age: 30, city: 'תל אביב', bio: 'יזם סטארטאפ עם חלום 🚀', gender: 'גבר', seed: 'Alon30m', lookingFor: 'קשר רציני', photo: '/demo/alon.jpg' },
  { name: 'נועם', age: 26, city: 'באר שבע', bio: 'מדריכת כושר ואוהבת טבע 💪', gender: 'אישה', seed: 'Noam26f', lookingFor: 'משהו קליל', photo: '/demo/noam.jpg' },
  { name: 'גיל', age: 25, city: 'נתניה', bio: 'דיג׳יי בסופשים ומתכנת בשאר הזמן 🎵', gender: 'גבר', seed: 'Gil25m', lookingFor: 'עוד לא יודע/ת', photo: '/demo/gil.jpg' },
  { name: 'הילה', age: 23, city: 'רעננה', bio: 'אופטימיסטית מטבע, אוהבת ים 🌊', gender: 'אישה', seed: 'Hila23f', lookingFor: 'קשר רציני', photo: '/demo/hila.jpg' },
  { name: 'תומר', age: 28, city: 'מודיעין', bio: 'רופא שיניים בהכשרה, חייכו! 😁', gender: 'גבר', seed: 'Tomer28m', lookingFor: 'משהו קליל', photo: '/demo/tomer.jpg' },
  { name: 'רוני', age: 24, city: 'תל אביב', bio: 'בואו נהיה חברות קודם ☕', gender: 'אישה', seed: 'Roni24f', lookingFor: 'חברים/ות', photo: '/demo/roni.jpg' },
  { name: 'עידו', age: 31, city: 'ירושלים', bio: 'עורך דין, ספרן מושבע, רץ מרתון 📚', gender: 'גבר', seed: 'Ido31m', lookingFor: 'קשר רציני', photo: '/demo/ido.jpg' },
];

export const LIKED_BY = new Set(['Shir23f', 'Agam22f', 'Roni24f']);
export const PRE_MATCHED = new Set(['Tamar25f', 'Noa24f']);

export const INITIAL_CONVOS: Record<string, DemoMsg[]> = {
  Tamar25f: [
    { id: 1, text: 'היי! 😊', type: 'text', sent: false, time: '20:14' },
    { id: 2, text: 'היי תמר, מה קורה?', type: 'text', sent: true, time: '20:15' },
    { id: 3, text: 'הכל טוב! אירוע מדהים, לא?', type: 'text', sent: false, time: '20:16' },
    { id: 4, text: 'ממש! רוצה להיפגש?', type: 'text', sent: true, time: '20:18' },
  ],
  Noa24f: [
    { id: 1, text: 'היי!', type: 'text', sent: true, time: '20:20' },
    { id: 2, text: 'היי 🥰 נעים מאוד', type: 'text', sent: false, time: '20:21' },
  ],
};

export const AUTO_REPLIES = ['😊 נעים מאוד!', 'כן! אירוע מדהים', 'מסכים/ה לגמרי 😂', 'בוא/י נדבר אחרי?', 'תודה על הלייק 💕', 'איזה כיף!'];
