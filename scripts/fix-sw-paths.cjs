/**
 * Fix Windows backslash paths in the Serwist-generated service worker.
 * On Windows, glob returns backslashes in precache manifest URLs,
 * which never match browser fetch requests (browsers use forward slashes).
 * This post-build step normalizes all backslashes to forward slashes in sw.js.
 * On Linux/macOS this is a no-op (no backslashes to replace).
 */
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');

if (fs.existsSync(swPath)) {
  const content = fs.readFileSync(swPath, 'utf8');
  const fixed = content.replace(/\\\\/g, '/');
  if (content !== fixed) {
    fs.writeFileSync(swPath, fixed, 'utf8');
    console.log('✓ Fixed backslash paths in public/sw.js');
  } else {
    console.log('✓ No backslash paths found in public/sw.js (already clean)');
  }
} else {
  console.log('⚠ public/sw.js not found — skipping path fix');
}
