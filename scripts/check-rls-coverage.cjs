#!/usr/bin/env node
/**
 * RLS coverage guard (SECURITY_HARDENING_PLAN §9, §21).
 *
 * Statically scans every SQL file under supabase/ and fails if any table that is
 * created is never given `ENABLE ROW LEVEL SECURITY`. A public Postgres table without
 * RLS is readable/writable by the anon/authenticated roles — for this app's data
 * (orientation, photos, messages, phones) that would be a critical exposure.
 *
 * This is a heuristic on SQL text (no DB connection needed, so it runs in CI). It is
 * intentionally conservative: tables that are dropped are ignored, and a small explicit
 * allowlist covers tables that legitimately do not need RLS. Anything else missing RLS
 * is a hard failure.
 *
 * Usage: node scripts/check-rls-coverage.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SUPABASE_DIR = path.join(ROOT, 'supabase');

/**
 * Tables that do not require RLS, with a justification. Keep this list short and
 * deliberate — every entry is a reviewed exception.
 */
const RLS_EXEMPT = new Map([
  // (none today — all app tables are expected to enable RLS)
]);

function collectSqlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSqlFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.sql')) out.push(full);
  }
  return out;
}

function normalizeName(raw) {
  return raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();
}

function main() {
  if (!fs.existsSync(SUPABASE_DIR)) {
    console.error('[rls-check] supabase/ directory not found.');
    process.exit(1);
  }

  const files = collectSqlFiles(SUPABASE_DIR);
  let sql = '';
  for (const f of files) sql += '\n' + fs.readFileSync(f, 'utf8');

  // Strip line comments so commented-out DDL is ignored.
  sql = sql.replace(/--[^\n]*/g, '');

  const created = new Set();
  const dropped = new Set();
  const rlsEnabled = new Set();

  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/gi;
  const dropRe = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/gi;
  const rlsRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?("?[\w.]+"?)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  let m;
  while ((m = createRe.exec(sql))) created.add(normalizeName(m[1]));
  while ((m = dropRe.exec(sql))) dropped.add(normalizeName(m[1]));
  while ((m = rlsRe.exec(sql))) rlsEnabled.add(normalizeName(m[1]));

  const missing = [];
  for (const table of created) {
    if (dropped.has(table)) continue;       // table no longer exists
    if (rlsEnabled.has(table)) continue;     // RLS enabled somewhere
    if (RLS_EXEMPT.has(table)) continue;     // reviewed exception
    missing.push(table);
  }

  console.log(`[rls-check] Scanned ${files.length} SQL files.`);
  console.log(`[rls-check] Tables created: ${created.size}, dropped: ${dropped.size}, RLS-enabled: ${rlsEnabled.size}.`);

  if (missing.length > 0) {
    console.error('\n[rls-check] FAIL — these tables have no `ENABLE ROW LEVEL SECURITY`:');
    for (const t of missing.sort()) console.error(`  - ${t}`);
    console.error('\nEnable RLS (and appropriate policies), or add a justified entry to RLS_EXEMPT.');
    process.exit(1);
  }

  console.log('[rls-check] All created tables enable RLS. ✓');
}

main();
