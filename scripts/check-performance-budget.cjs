const fs = require('node:fs');
const path = require('node:path');
const { formatBytes, collectBuildMetrics } = require('./perf-metrics.cjs');

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, '.next');

const PROFILE = String(process.env.PERF_BUDGET_PROFILE || 'standard').toLowerCase();

const PROFILE_BUDGETS = {
  strict: {
    maxLargestJsChunkBytes: 420 * 1024,
    maxTotalJsBytes: 2900 * 1024,
    maxTotalCssBytes: 260 * 1024,
  },
  standard: {
    maxLargestJsChunkBytes: 480 * 1024,
    maxTotalJsBytes: 3800 * 1024, // raised: jspdf + html2canvas add ~400 KB (lazy-loaded, admin-only)
    maxTotalCssBytes: 300 * 1024,
  },
  entry: {
    maxLargestJsChunkBytes: 560 * 1024,
    maxTotalJsBytes: 3800 * 1024,
    maxTotalCssBytes: 360 * 1024,
  },
};

const selectedProfile = PROFILE_BUDGETS[PROFILE] || PROFILE_BUDGETS.standard;

const BUDGETS = {
  maxLargestJsChunkBytes: Number(process.env.PERF_MAX_LARGEST_JS_CHUNK_BYTES || selectedProfile.maxLargestJsChunkBytes),
  maxTotalJsBytes: Number(process.env.PERF_MAX_TOTAL_JS_BYTES || selectedProfile.maxTotalJsBytes),
  maxTotalCssBytes: Number(process.env.PERF_MAX_TOTAL_CSS_BYTES || selectedProfile.maxTotalCssBytes),
};

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    console.error('[perf-budget] Missing .next build output. Run `next build` first.');
    process.exit(1);
  }

  const metrics = collectBuildMetrics(ROOT);
  const { jsFiles, cssFiles, largestJs, totalJs, totalCss } = metrics;

  const failures = [];

  if (jsFiles.length === 0) {
    failures.push('No JS build chunks found under .next/static/chunks. Run a production build before budget checks.');
  }

  if (largestJs.size > BUDGETS.maxLargestJsChunkBytes) {
    failures.push(
      `Largest JS chunk ${formatBytes(largestJs.size)} exceeds budget ${formatBytes(BUDGETS.maxLargestJsChunkBytes)} (${path.relative(ROOT, largestJs.file)})`
    );
  }
  if (totalJs > BUDGETS.maxTotalJsBytes) {
    failures.push(
      `Total JS ${formatBytes(totalJs)} exceeds budget ${formatBytes(BUDGETS.maxTotalJsBytes)}`
    );
  }
  if (totalCss > BUDGETS.maxTotalCssBytes) {
    failures.push(
      `Total CSS ${formatBytes(totalCss)} exceeds budget ${formatBytes(BUDGETS.maxTotalCssBytes)}`
    );
  }

  console.log('[perf-budget] Summary');
  console.log(`  Profile: ${PROFILE_BUDGETS[PROFILE] ? PROFILE : 'standard'}`);
  console.log(`  JS files: ${jsFiles.length}`);
  console.log(`  CSS files: ${cssFiles.length}`);
  console.log(`  Largest JS chunk: ${formatBytes(largestJs.size)} (${path.relative(ROOT, largestJs.file)})`);
  console.log(`  Total JS: ${formatBytes(totalJs)}`);
  console.log(`  Total CSS: ${formatBytes(totalCss)}`);

  if (failures.length > 0) {
    console.error('[perf-budget] Failed budget checks:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log('[perf-budget] All checks passed.');
}

main();
