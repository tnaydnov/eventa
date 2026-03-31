/**
 * Seed Demo Event: Creates a demo event with the same users/photos from the landing page DemoPhone.
 *
 * Usage: node scripts/seed-demo-event.cjs
 *
 * - Creates (or reuses) a demo event called "החתונה של דנה ואיתי - דמו"
 * - Downloads the 18 demo photos from the production site (public/demo/*.jpg)
 * - Creates participants matching the DemoPhone demo-data
 * - Adds some likes and a match to make it look alive
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Load .env.local ───
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
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || 'https://eventa.productions';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Demo data (matches demo-data.ts from the landing page DemoPhone) ───

const DEMO_USERS = [
  { name: 'נועה',   age: 24, city: 'תל אביב',       bio: 'אוהבת ריקודים, מוזיקה וערבי יין 🍷',          gender: 'female', attracted_to: 'men',   looking_for: 'serious',      photo: 'noa.jpg' },
  { name: 'איתי',   age: 27, city: 'הרצליה',         bio: 'סרפר בשבתות, שף חובב בימי חול 🏄‍♂️',          gender: 'male',   attracted_to: 'women', looking_for: 'casual',       photo: 'itay.jpg' },
  { name: 'מאיה',   age: 25, city: 'רמת גן',         bio: 'מעצבת גרפית, חולמת בגדול 🎨',                gender: 'female', attracted_to: 'men',   looking_for: 'friends',      photo: 'maya.jpg' },
  { name: 'דניאל',  age: 28, city: 'תל אביב',       bio: 'מפתח תוכנה ואוהב טיולים בטבע 🌿',            gender: 'male',   attracted_to: 'women', looking_for: 'serious',      photo: 'daniel.jpg' },
  { name: 'שיר',    age: 23, city: 'חיפה',           bio: 'סטודנטית לפסיכולוגיה, אוהבת חתולים 🐱',       gender: 'female', attracted_to: 'men',   looking_for: 'figuring_out', photo: 'shir.jpg' },
  { name: 'עומר',   age: 26, city: 'ראשון לציון',    bio: 'מוזיקאי וצלם חובב 📸',                       gender: 'male',   attracted_to: 'women', looking_for: 'casual',       photo: 'omer.jpg' },
  { name: 'תמר',    age: 25, city: 'תל אביב',       bio: 'עורכת דין ביום, יוגיסטית בלילה 🧘‍♀️',          gender: 'female', attracted_to: 'men',   looking_for: 'serious',      photo: 'tamar.jpg' },
  { name: 'יונתן',  age: 29, city: 'פתח תקווה',     bio: 'מהנדס מזון, שוחרי אוכל טוב 🍕',              gender: 'male',   attracted_to: 'women', looking_for: 'friends',      photo: 'yonatan.jpg' },
  { name: 'ליאור',  age: 24, city: 'גבעתיים',        bio: 'רקדנית היפ-הופ, חיוכים 24/7 💃',              gender: 'female', attracted_to: 'men',   looking_for: 'casual',       photo: 'lior.jpg' },
  { name: 'רועי',   age: 27, city: 'כפר סבא',        bio: 'רואה חשבון עם תשוקה לקומדיות 😂',            gender: 'male',   attracted_to: 'women', looking_for: 'figuring_out', photo: 'roi.jpg' },
  { name: 'אגם',    age: 22, city: 'הוד השרון',      bio: 'סטודנטית לאומנות, צמחונית גאה 🌻',            gender: 'female', attracted_to: 'men',   looking_for: 'friends',      photo: 'agam.jpg' },
  { name: 'אלון',   age: 30, city: 'תל אביב',       bio: 'יזם סטארטאפ עם חלום 🚀',                     gender: 'male',   attracted_to: 'women', looking_for: 'serious',      photo: 'alon.jpg' },
  { name: 'נועם',   age: 26, city: 'באר שבע',        bio: 'מדריכת כושר ואוהבת טבע 💪',                  gender: 'female', attracted_to: 'men',   looking_for: 'casual',       photo: 'noam.jpg' },
  { name: 'גיל',    age: 25, city: 'נתניה',          bio: 'דיג׳יי בסופשים ומתכנת בשאר הזמן 🎵',         gender: 'male',   attracted_to: 'women', looking_for: 'figuring_out', photo: 'gil.jpg' },
  { name: 'הילה',   age: 23, city: 'רעננה',          bio: 'אופטימיסטית מטבע, אוהבת ים 🌊',              gender: 'female', attracted_to: 'men',   looking_for: 'serious',      photo: 'hila.jpg' },
  { name: 'תומר',   age: 28, city: 'מודיעין',        bio: 'רופא שיניים בהכשרה, חייכו! 😁',              gender: 'male',   attracted_to: 'women', looking_for: 'casual',       photo: 'tomer.jpg' },
  { name: 'רוני',   age: 24, city: 'תל אביב',       bio: 'בואו נהיה חברות קודם ☕',                    gender: 'female', attracted_to: 'men',   looking_for: 'friends',      photo: 'roni.jpg' },
  { name: 'עידו',   age: 31, city: 'ירושלים',        bio: 'עורך דין, ספרן מושבע, רץ מרתון 📚',          gender: 'male',   attracted_to: 'women', looking_for: 'serious',      photo: 'ido.jpg' },
];

// ─── Config ───
const DEMO_EVENT_SLUG = 'demo-event';
const DEMO_EVENT_NAME = 'Tomer & Amit';
const DEMO_JOIN_CODE = 'demo24';

function randomFingerprint() {
  return [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ─── Download photo from public/demo/ on the production site ───
async function downloadDemoPhoto(filename) {
  // Try to read from local public/demo/ first
  const localPath = path.join(__dirname, '..', 'public', 'demo', filename);
  if (fs.existsSync(localPath)) {
    console.log(`   📂 Using local file: ${filename}`);
    return fs.readFileSync(localPath);
  }

  // Fallback: download from production
  const url = `${SITE_URL}/demo/${filename}`;
  console.log(`   🌐 Downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Main ───
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('   Eventa Demo Event Seeder');
  console.log('═══════════════════════════════════════\n');

  // ── Step 1: Find or create the demo event ──
  console.log('🔍 Looking for existing demo event...');

  let event;
  const { data: existing } = await supabase
    .from('events')
    .select('*')
    .eq('slug', DEMO_EVENT_SLUG)
    .maybeSingle();

  if (existing) {
    event = existing;
    console.log(`✅ Found existing demo event: "${event.name}" (${event.id})`);
    console.log('   Cleaning up existing data...\n');

    // Clean existing participants + related data
    const { data: existingPhotos } = await supabase
      .from('participant_photos')
      .select('storage_path')
      .eq('event_id', event.id);

    if (existingPhotos?.length) {
      const paths = existingPhotos.map(p => p.storage_path);
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from('photos').remove(paths.slice(i, i + 100));
      }
      console.log(`   🗑️  Deleted ${paths.length} photos from storage`);
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
    await supabase.from('participants').delete().eq('event_id', event.id);
    console.log('   🗑️  Cleaned all existing participants & data\n');

    // Update event fields in case they changed
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { error: updateErr } = await supabase
      .from('events')
      .update({
        name: DEMO_EVENT_NAME,
        join_code: DEMO_JOIN_CODE,
        status: 'active',
        is_active: true,
        ends_at: endsAt.toISOString(),
      })
      .eq('id', event.id);

    if (updateErr) {
      console.warn(`   ⚠️  Failed to update event: ${updateErr.message}`);
    } else {
      event.name = DEMO_EVENT_NAME;
      event.join_code = DEMO_JOIN_CODE;
      console.log(`   ✏️  Updated event name="${DEMO_EVENT_NAME}", join_code="${DEMO_JOIN_CODE}"\n`);
    }
  } else {
    console.log('   Not found — creating new demo event...');

    // Event runs for 30 days from now
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { data: newEvent, error: createErr } = await supabase
      .from('events')
      .insert({
        slug: DEMO_EVENT_SLUG,
        name: DEMO_EVENT_NAME,
        join_code: DEMO_JOIN_CODE,
        event_type: 'wedding',
        status: 'active',
        is_active: true,
        description: 'אירוע דמו להדגמת המערכת',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select()
      .single();

    if (createErr) {
      console.error('❌ Failed to create event:', createErr.message);
      process.exit(1);
    }

    event = newEvent;
    console.log(`✅ Created demo event: "${event.name}" (${event.id})`);
    console.log(`   Slug: ${event.slug}`);
    console.log(`   Join code: ${DEMO_JOIN_CODE}`);
    console.log(`   Expires: ${endsAt.toLocaleDateString('he-IL')}\n`);
  }

  // ── Step 2: Create participants ──
  console.log(`👥 Creating ${DEMO_USERS.length} demo participants...\n`);

  const participantRows = DEMO_USERS.map(u => ({
    event_id: event.id,
    display_name: u.name,
    gender: u.gender,
    attracted_to: u.attracted_to,
    bio: u.bio,
    age: u.age,
    city: u.city,
    looking_for: u.looking_for,
    device_fingerprint: randomFingerprint(),
    is_banned: false,
    last_seen_at: new Date().toISOString(),
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('participants')
    .insert(participantRows)
    .select('id, display_name, gender');

  if (insertErr) {
    console.error('❌ Failed to insert participants:', insertErr.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${inserted.length} participants`);

  // Build lookup: name -> id
  const nameToId = {};
  for (const p of inserted) {
    nameToId[p.display_name] = p.id;
  }

  // ── Step 3: Upload photos ──
  console.log('\n📸 Uploading demo photos to Supabase Storage...\n');
  let photoCount = 0;

  for (let i = 0; i < DEMO_USERS.length; i++) {
    const user = DEMO_USERS[i];
    const participantId = nameToId[user.name];

    try {
      const photoBuffer = await downloadDemoPhoto(user.photo);
      const storagePath = `${event.id}/${participantId}/0.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(storagePath, photoBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErr) {
        console.warn(`   ⚠️  Upload failed for ${user.name}: ${uploadErr.message}`);
        continue;
      }

      // Insert photo record
      const { error: photoRecErr } = await supabase
        .from('participant_photos')
        .insert({
          event_id: event.id,
          participant_id: participantId,
          storage_path: storagePath,
          order_index: 0,
        });

      if (photoRecErr) {
        console.warn(`   ⚠️  Photo record failed for ${user.name}: ${photoRecErr.message}`);
        continue;
      }

      photoCount++;
      process.stdout.write(`\r   Uploaded ${photoCount}/${DEMO_USERS.length} photos`);
    } catch (err) {
      console.warn(`\n   ⚠️  Photo failed for ${user.name}: ${err.message}`);
    }
  }

  console.log('\n');

  // ── Step 4: Add some likes & matches to make it look alive ──
  console.log('💕 Adding demo likes and matches...\n');

  // Some likes (women -> men)
  const likePairs = [
    ['שיר',  'דניאל'],
    ['אגם',  'איתי'],
    ['רוני', 'עומר'],
    ['נועה', 'דניאל'],  // mutual with below
    ['תמר',  'איתי'],   // mutual with below
    ['הילה', 'אלון'],
    ['מאיה', 'גיל'],
    ['ליאור', 'רועי'],
  ];

  // Mutual likes (men -> women) - creates matches with the women who liked them above
  const mutualLikes = [
    ['דניאל', 'נועה'],   // match!
    ['איתי',  'תמר'],    // match!
  ];

  const allLikes = [...likePairs, ...mutualLikes];

  for (const [fromName, toName] of allLikes) {
    const fromId = nameToId[fromName];
    const toId = nameToId[toName];
    if (!fromId || !toId) {
      console.warn(`   ⚠️  Like skipped: ${fromName} -> ${toName} (not found)`);
      continue;
    }

    const { error: likeErr } = await supabase.from('likes').insert({
      event_id: event.id,
      from_participant_id: fromId,
      to_participant_id: toId,
    });

    if (likeErr) {
      console.warn(`   ⚠️  Like failed: ${fromName} -> ${toName}: ${likeErr.message}`);
    } else {
      console.log(`   ❤️  ${fromName} → ${toName}`);
    }
  }

  // ── Step 5: Create conversations for mutual matches ──
  console.log('\n💬 Creating demo conversations...\n');

  const matches = [
    { a: 'דניאל', b: 'נועה' },
    { a: 'איתי', b: 'תמר' },
  ];

  for (const match of matches) {
    const aId = nameToId[match.a];
    const bId = nameToId[match.b];

    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .insert({
        event_id: event.id,
        a_participant_id: aId,
        b_participant_id: bId,
      })
      .select()
      .single();

    if (convoErr) {
      console.warn(`   ⚠️  Conversation failed: ${match.a} & ${match.b}: ${convoErr.message}`);
      continue;
    }

    console.log(`   💬 ${match.a} ↔ ${match.b} (conversation created)`);

    // Add a few messages
    const messages = [
      { conversation_id: convo.id, event_id: event.id, sender_participant_id: bId, text: 'היי! 😊', created_at: new Date(Date.now() - 3600000).toISOString() },
      { conversation_id: convo.id, event_id: event.id, sender_participant_id: aId, text: `היי ${match.b}, מה קורה?`, created_at: new Date(Date.now() - 3500000).toISOString() },
      { conversation_id: convo.id, event_id: event.id, sender_participant_id: bId, text: 'הכל טוב! אירוע מדהים, לא?', created_at: new Date(Date.now() - 3400000).toISOString() },
    ];

    const { error: msgErr } = await supabase.from('messages').insert(messages);
    if (msgErr) {
      console.warn(`   ⚠️  Messages failed: ${msgErr.message}`);
    } else {
      console.log(`      📝 Added ${messages.length} messages`);
    }
  }

  // ── Done ──
  console.log('\n═══════════════════════════════════════');
  console.log('🎉 Demo event ready!');
  console.log('═══════════════════════════════════════');
  console.log(`\n   Event:     ${event.name}`);
  console.log(`   Slug:      ${event.slug}`);
  console.log(`   Join code: ${DEMO_JOIN_CODE}`);
  console.log(`   Users:     ${inserted.length} participants`);
  console.log(`   Photos:    ${photoCount} uploaded`);
  console.log(`   URL:       ${SITE_URL}/dating/${event.slug}/join`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
