/**
 * Seed script: Generate fake participants for an event.
 *
 * Usage: node scripts/seed-fake-users.cjs
 *
 * - Finds the event "החתונה של דנה ואיתי"
 * - Deletes all existing participants + photos for that event
 * - Creates 40 fake participants (20 men, 20 women) with Hebrew names
 * - Downloads portrait photos from randomuser.me and uploads to Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Fake Data ───

const MALE_NAMES = [
  'אורי', 'נועם', 'איתן', 'יונתן', 'עומר', 'דניאל', 'אלון', 'גיל',
  'רועי', 'תומר', 'אדם', 'ליאור', 'עידו', 'שחר', 'ניר', 'יואב',
  'מתן', 'אסף', 'בן', 'דור',
];

const FEMALE_NAMES = [
  'נועה', 'מאיה', 'שירה', 'יעל', 'תמר', 'ליאת', 'רוני', 'הילה',
  'דנה', 'עדי', 'שי', 'אורלי', 'מיכל', 'רותם', 'גלי', 'נטלי',
  'ליהי', 'אופיר', 'טל', 'קרן',
];

const CITIES = [
  'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'רמת גן', 'הרצליה',
  'נתניה', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'כפר סבא', 'רעננה',
  'הוד השרון', 'גבעתיים', 'רחובות', 'מודיעין',
];

const MALE_BIOS = [
  'אוהב לטייל, לבשל ולצפות בסדרות 🎬',
  'מהנדס תוכנה, גולש וחובב קפה ☕',
  'מוזיקאי חובב, אוהב ג\'אז וים 🎸',
  'סטודנט למשפטים, חובב ספורט 🏀',
  'עובד בהייטק, אוהב אוכל טוב ויין 🍷',
  'אופטימיסט, מטייל, ותמיד מחפש הרפתקאות ✈️',
  'צלם חובב, חובב טבע ופיצות 📸',
  'מנהל מוצר, חובב בירה מלאכתית ובורד גיימס 🎲',
  'פיזיותרפיסט, רץ מרתונים, אוהב חיות 🐕',
  'ארכיטקט, חובב עיצוב ואמנות 🎨',
  'שף, חובב נסיעות וטעמים חדשים 🍽️',
  'מורה להיסטוריה, קורא ספרים ואוהב טיולים 📚',
  'יזם, חובב טכנולוגיה וחדשנות 💡',
  'רואה חשבון, אוהב כדורגל ובישול 🥘',
  'מתכנת, גיימר, אוהב לגלות מקומות חדשים 🎮',
  'עורך דין, חובב יין ומסעדות טובות 🏛️',
  'מעצב גרפי, אוהב הופעות חיות 🎤',
  'פסיכולוג, חובב יוגה ומדיטציה 🧘',
  'סטודנט לרפואה, אוהב לרוץ ולבשל 🏃',
  'עובד סוציאלי, חובב מוזיקה ותיאטרון 🎭',
];

const FEMALE_BIOS = [
  'אוהבת יוגה, בישול ושקיעות 🌅',
  'מעצבת פנים, חובבת אמנות וקפה ☕',
  'סטודנטית לפסיכולוגיה, אוהבת ספרים ומוזיקה 📖',
  'עורכת דין, חובבת טיולים ויין 🌍',
  'מהנדסת תוכנה, אוהבת חתולים ופודקאסטים 🐱',
  'מורה, חובבת ריקוד ואפייה 🎂',
  'רופאת שיניים, אוהבת ים ומסעדות 🏖️',
  'מנהלת שיווק, חובבת כושר ובישול 💪',
  'אדריכלית, חובבת צילום ועיצוב 📷',
  'סטודנטית לרפואה, אוהבת טיולים ומוזיקה 🎵',
  'עובדת סוציאלית, חובבת קריאה ויוגה 🧘‍♀️',
  'כלכלנית, אוהבת נסיעות וקולנוע 🎬',
  'מתכנתת, חובבת משחקי קופסה וסדרות 📺',
  'גרפיקאית, אוהבת אמנות רחוב ופסטיבלים 🎨',
  'דיאטנית, חובבת בישול בריא וכושר 🥗',
  'עיתונאית, אוהבת לכתוב ולגלות דברים חדשים ✍️',
  'רקדנית, חובבת מוזיקה לטינית 💃',
  'רוקחת, אוהבת טבע ובעלי חיים 🌿',
  'אנימטורית, חובבת ציור ומנגה 🎌',
  'מלצרית ושחקנית, אוהבת תיאטרון וקפה ☕',
];

const LOOKING_FOR_OPTIONS = ['serious', 'casual', 'friends', 'figuring_out'];
const ATTRACTED_TO_OPTIONS_MALE = ['women', 'women', 'women', 'women', 'all']; // mostly women
const ATTRACTED_TO_OPTIONS_FEMALE = ['men', 'men', 'men', 'men', 'all']; // mostly men

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAge() {
  return Math.floor(Math.random() * 15) + 22; // 22-36
}

function randomFingerprint() {
  return [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function downloadPhoto(name, gender) {
  // DiceBear avataaars - cartoon-style avatars, clearly not real photos
  const seed = encodeURIComponent(`${name}-${gender}-${Date.now()}`);
  const url = `https://api.dicebear.com/9.x/avataaars/png?seed=${seed}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download avatar: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  console.log('🔍 Finding event "החתונה של דנה ואיתי"...');

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, name, slug')
    .ilike('name', '%דנה%איתי%');

  if (evErr || !events?.length) {
    console.error('Event not found. Events:', evErr?.message);
    // List all events for reference
    const { data: all } = await supabase.from('events').select('id, name');
    console.log('Available events:', all?.map(e => `${e.name} (${e.id})`));
    process.exit(1);
  }

  const event = events[0];
  console.log(`✅ Found event: "${event.name}" (${event.id})`);

  // ── Delete existing participants ──
  console.log('🗑️  Deleting existing data...');

  // Get existing photos for storage cleanup
  const { data: existingPhotos } = await supabase
    .from('participant_photos')
    .select('storage_path')
    .eq('event_id', event.id);

  if (existingPhotos?.length) {
    const paths = existingPhotos.map(p => p.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from('photos').remove(paths.slice(i, i + 100));
    }
    console.log(`   Deleted ${paths.length} photos from storage`);
  }

  // Delete DB rows (FK cascade order)
  await supabase.from('notifications').delete().eq('event_id', event.id);
  await supabase.from('likes').delete().eq('event_id', event.id);
  await supabase.from('blocks').delete().eq('event_id', event.id);
  await supabase.from('activity_log').delete().eq('event_id', event.id);
  await supabase.from('messages').delete().eq('event_id', event.id);
  await supabase.from('conversations').delete().eq('event_id', event.id);
  await supabase.from('participant_photos').delete().eq('event_id', event.id);
  await supabase.from('banned_devices').delete().eq('event_id', event.id);

  // Count existing participants
  const { count: existingCount } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id);

  await supabase.from('participants').delete().eq('event_id', event.id);
  console.log(`   Deleted ${existingCount || 0} existing participants`);

  // ── Create fake participants ──
  const TOTAL_MEN = 20;
  const TOTAL_WOMEN = 20;
  console.log(`\n👥 Creating ${TOTAL_MEN + TOTAL_WOMEN} fake participants...`);

  const participants = [];

  // Men
  for (let i = 0; i < TOTAL_MEN; i++) {
    participants.push({
      event_id: event.id,
      display_name: MALE_NAMES[i],
      gender: 'male',
      attracted_to: pick(ATTRACTED_TO_OPTIONS_MALE),
      bio: MALE_BIOS[i],
      age: randomAge(),
      city: pick(CITIES),
      looking_for: pick(LOOKING_FOR_OPTIONS),
      device_fingerprint: randomFingerprint(),
      is_banned: false,
      last_seen_at: new Date().toISOString(),
    });
  }

  // Women
  for (let i = 0; i < TOTAL_WOMEN; i++) {
    participants.push({
      event_id: event.id,
      display_name: FEMALE_NAMES[i],
      gender: 'female',
      attracted_to: pick(ATTRACTED_TO_OPTIONS_FEMALE),
      bio: FEMALE_BIOS[i],
      age: randomAge(),
      city: pick(CITIES),
      looking_for: pick(LOOKING_FOR_OPTIONS),
      device_fingerprint: randomFingerprint(),
      is_banned: false,
      last_seen_at: new Date().toISOString(),
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('participants')
    .insert(participants)
    .select('id, display_name, gender');

  if (insertErr) {
    console.error('Failed to insert participants:', insertErr.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${inserted.length} participants`);

  // ── Upload photos ──
  console.log('\n📸 Downloading and uploading avatar photos...');
  let photoCount = 0;

  for (const p of inserted) {
    try {
      const photoBuffer = await downloadPhoto(p.display_name, p.gender);
      const storagePath = `${event.id}/${p.id}/0.png`;

      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(storagePath, photoBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadErr) {
        console.warn(`   ⚠️  Upload failed for ${p.display_name}: ${uploadErr.message}`);
        continue;
      }

      // Insert photo record
      const { error: photoRecErr } = await supabase
        .from('participant_photos')
        .insert({
          event_id: event.id,
          participant_id: p.id,
          storage_path: storagePath,
          order_index: 0,
        });

      if (photoRecErr) {
        console.warn(`   ⚠️  Photo record failed for ${p.display_name}: ${photoRecErr.message}`);
        continue;
      }

      photoCount++;
      process.stdout.write(`\r   Uploaded ${photoCount}/${inserted.length} photos`);
    } catch (err) {
      console.warn(`\n   ⚠️  Photo failed for ${p.display_name}: ${err.message}`);
    }
  }

  console.log(`\n\n🎉 Done! Created ${inserted.length} participants with ${photoCount} photos.`);
  console.log(`   Event: "${event.name}" (${event.slug})`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
