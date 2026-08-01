#!/usr/bin/env node
/**
 * PII Backfill Script — encrypts all existing plaintext PII rows.
 *
 * Run AFTER applying migration 046_pii_encryption.sql in Supabase.
 *
 * Prerequisites:
 *   - FIELD_ENCRYPTION_KEY and BLIND_INDEX_KEY must be set in environment.
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.
 *
 * Usage:
 *   node scripts/backfill-pii.cjs
 *
 * Or with env from a file:
 *   npx dotenv -e .env.local -- node scripts/backfill-pii.cjs
 *
 * The script is idempotent: rows that already have phone_enc/email_enc set are
 * skipped. Safe to re-run if interrupted.
 */

'use strict';

const crypto = require('crypto');

// ─── Validate env ────────────────────────────────────────────────────────────

const REQUIRED = [
  'FIELD_ENCRYPTION_KEY',
  'BLIND_INDEX_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing env var: ${key}`);
    console.error('   Set all four vars before running this script.');
    process.exit(1);
  }
}

// ─── Crypto primitives ───────────────────────────────────────────────────────

const ALGO    = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PREFIX  = 'enc.v1.';

function loadKey(envName) {
  const raw = process.env[envName];
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) throw new Error(`${envName} must be 32 bytes base64`);
  return buf;
}

function encryptField(plaintext) {
  const key = loadKey('FIELD_ENCRYPTION_KEY');
  if (!key) throw new Error('No FIELD_ENCRYPTION_KEY');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, ciphertext, tag].map(b => b.toString('base64')).join('.');
}

function blindIndex(value) {
  const raw = process.env.BLIND_INDEX_KEY;
  if (!raw) throw new Error('No BLIND_INDEX_KEY');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('BLIND_INDEX_KEY must be 32 bytes base64');
  return crypto.createHmac('sha256', key).update(value.trim()).digest('hex');
}

function encPii(v) { return v ? encryptField(v) : null; }
function bi(v)     { return v ? blindIndex(v) : null; }

// ─── Supabase client ─────────────────────────────────────────────────────────

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supaFetch(path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`PATCH ${path} → ${res.status}: ${t}`);
  }
}

async function supaSelect(table, columns, filter) {
  const params = new URLSearchParams({ select: columns, ...filter });
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Range': '0-9999',
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GET ${table} → ${res.status}: ${t}`);
  }
  return res.json();
}

// ─── Backfill tasks ───────────────────────────────────────────────────────────

let totalUpdated = 0;

/**
 * Generic backfill for a table with a `phone` column + `phone_enc`/`phone_bi` siblings.
 * Skips rows where phone_enc is already set.
 */
async function backfillPhoneTable(table, extraFields = '') {
  console.log(`\n📱  Backfilling ${table}.phone …`);
  const cols = `id,phone${extraFields ? ',' + extraFields : ''}`;
  const rows = await supaSelect(table, cols, { 'phone_enc': 'is.null', 'phone': 'not.is.null' });
  console.log(`   Found ${rows.length} unencrypted rows.`);

  let n = 0;
  for (const row of rows) {
    const update = { phone_enc: encPii(row.phone), phone_bi: bi(row.phone) };
    await supaFetch(`${table}?id=eq.${row.id}`, update);
    n++;
    if (n % 50 === 0) process.stdout.write(`   ${n}/${rows.length}\r`);
  }
  totalUpdated += n;
  console.log(`   ✓  ${n} rows updated.`);
}

async function backfillParticipants() {
  console.log(`\n👤  Backfilling participants …`);
  const rows = await supaSelect(
    'participants',
    'id,phone,attracted_to,looking_for,bio',
    { 'phone_enc': 'is.null' }  // proxy: if phone_enc is null, nothing encrypted yet
  );
  console.log(`   Found ${rows.length} rows needing encryption.`);
  let n = 0;
  for (const row of rows) {
    const update = {
      phone_enc:        encPii(row.phone),
      phone_bi:         bi(row.phone),
      attracted_to_enc: encPii(row.attracted_to),
      looking_for_enc:  encPii(row.looking_for),
      bio_enc:          encPii(row.bio),
    };
    await supaFetch(`participants?id=eq.${row.id}`, update);
    n++;
    if (n % 50 === 0) process.stdout.write(`   ${n}/${rows.length}\r`);
  }
  totalUpdated += n;
  console.log(`   ✓  ${n} rows updated.`);
}

async function backfillEvents() {
  console.log(`\n🎉  Backfilling events …`);
  const rows = await supaSelect(
    'events',
    'id,client_name,client_email,client_phone',
    { 'client_email_enc': 'is.null' }
  );
  // Filter only rows that actually have some PII (many events may have no client contact)
  const toUpdate = rows.filter(r => r.client_name || r.client_email || r.client_phone);
  console.log(`   Found ${toUpdate.length} rows with PII.`);
  let n = 0;
  for (const row of toUpdate) {
    const update = {
      client_name_enc:  encPii(row.client_name),
      client_email_enc: encPii(row.client_email),
      client_email_bi:  bi(row.client_email),
      client_phone_enc: encPii(row.client_phone),
      client_phone_bi:  bi(row.client_phone),
    };
    await supaFetch(`events?id=eq.${row.id}`, update);
    n++;
  }
  totalUpdated += n;
  console.log(`   ✓  ${n} rows updated.`);
}

async function backfillEventRequests() {
  console.log(`\n📋  Backfilling event_requests …`);
  const rows = await supaSelect(
    'event_requests',
    'id,contact_name,contact_email,contact_phone',
    { 'contact_email_enc': 'is.null' }
  );
  console.log(`   Found ${rows.length} rows.`);
  let n = 0;
  for (const row of rows) {
    const update = {
      contact_name_enc:  encPii(row.contact_name),
      contact_email_enc: encPii(row.contact_email),
      contact_email_bi:  bi(row.contact_email),
      contact_phone_enc: encPii(row.contact_phone),
      contact_phone_bi:  bi(row.contact_phone),
    };
    await supaFetch(`event_requests?id=eq.${row.id}`, update);
    n++;
    if (n % 50 === 0) process.stdout.write(`   ${n}/${rows.length}\r`);
  }
  totalUpdated += n;
  console.log(`   ✓  ${n} rows updated.`);
}

async function backfillGuestPhones() {
  console.log(`\n📞  Backfilling event_guest_phones …`);
  const rows = await supaSelect(
    'event_guest_phones',
    'id,phone,guest_name',
    { 'phone_enc': 'is.null', 'phone': 'not.is.null' }
  );
  console.log(`   Found ${rows.length} rows.`);
  let n = 0;
  for (const row of rows) {
    const update = {
      phone_enc:      encPii(row.phone),
      phone_bi:       bi(row.phone),
      guest_name_enc: encPii(row.guest_name),
    };
    await supaFetch(`event_guest_phones?id=eq.${row.id}`, update);
    n++;
    if (n % 50 === 0) process.stdout.write(`   ${n}/${rows.length}\r`);
  }
  totalUpdated += n;
  console.log(`   ✓  ${n} rows updated.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐  PII Backfill — encrypting existing plaintext data');
  console.log('   Supabase:', SUPA_URL);
  console.log('   Encryption key loaded:', !!process.env.FIELD_ENCRYPTION_KEY);
  console.log('   Blind index key loaded:', !!process.env.BLIND_INDEX_KEY);
  console.log('');

  const start = Date.now();

  await backfillParticipants();
  await backfillEvents();
  await backfillEventRequests();
  await backfillGuestPhones();
  await backfillPhoneTable('otp_verifications');
  await backfillPhoneTable('message_log');
  await backfillPhoneTable('discount_claims');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅  Done. ${totalUpdated} rows encrypted in ${elapsed}s.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify the app works normally (decryption is live).');
  console.log('  2. Check a few rows in Supabase Table Editor — _enc columns should have "enc.v1." values.');
  console.log('  3. Old plaintext columns are kept as fallback. Drop them later when confident.');
}

main().catch(err => {
  console.error('\n❌  Backfill failed:', err.message);
  process.exit(1);
});
