const fs = require('node:fs');
const path = require('node:path');
const { formatBytes, collectBuildMetrics } = require('./perf-metrics.cjs');

const ROOT = process.cwd();
const BASELINE_PATH = process.env.PERF_BASELINE_PATH || path.join(ROOT, 'scripts', 'perf-budget-baseline.json');

const THRESHOLDS = {
  largestJsPct: Number(process.env.PERF_REGRESSION_MAX_LARGEST_JS_PCT || 10),
  totalJsPct: Number(process.env.PERF_REGRESSION_MAX_TOTAL_JS_PCT || 10),
  totalCssPct: Number(process.env.PERF_REGRESSION_MAX_TOTAL_CSS_PCT || 12),
};

function pctChange(current, baseline) {
  if (baseline <= 0) return current > 0 ? 100 : 0;
  return ((current - baseline) / baseline) * 100;
}

function readBaseline(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing baseline file: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed?.metrics) {
    throw new Error(`Invalid baseline format in ${filePath}`);
  }

  return parsed;
}

function main() {
  const { nextDir, jsFiles, cssFiles, largestJs, totalJs, totalCss } = collectBuildMetrics(ROOT);

  if (!fs.existsSync(nextDir) || jsFiles.length === 0) {
    console.error('[perf-regression] Missing build artifacts. Run `next build` first.');
    process.exit(1);
  }

  let baseline;
  try {
    baseline = readBaseline(BASELINE_PATH);
  } catch (err) {
    console.error(`[perf-regression] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const current = {
    largestJsChunkBytes: largestJs.size,
    totalJsBytes: totalJs,
    totalCssBytes: totalCss,
  };

  const base = {
    largestJsChunkBytes: Number(baseline.metrics.largestJsChunkBytes || 0),
    totalJsBytes: Number(baseline.metrics.totalJsBytes || 0),
    totalCssBytes: Number(baseline.metrics.totalCssBytes || 0),
  };

  const deltas = {
    largestJsPct: pctChange(current.largestJsChunkBytes, base.largestJsChunkBytes),
    totalJsPct: pctChange(current.totalJsBytes, base.totalJsBytes),
    totalCssPct: pctChange(current.totalCssBytes, base.totalCssBytes),
  };

  const failures = [];

  if (deltas.largestJsPct > THRESHOLDS.largestJsPct) {
    failures.push(
      `Largest JS chunk regression ${deltas.largestJsPct.toFixed(2)}% exceeds ${THRESHOLDS.largestJsPct}% (${formatBytes(base.largestJsChunkBytes)} -> ${formatBytes(current.largestJsChunkBytes)})`
    );
  }
  if (deltas.totalJsPct > THRESHOLDS.totalJsPct) {
    failures.push(
      `Total JS regression ${deltas.totalJsPct.toFixed(2)}% exceeds ${THRESHOLDS.totalJsPct}% (${formatBytes(base.totalJsBytes)} -> ${formatBytes(current.totalJsBytes)})`
    );
  }
  if (deltas.totalCssPct > THRESHOLDS.totalCssPct) {
    failures.push(
      `Total CSS regression ${deltas.totalCssPct.toFixed(2)}% exceeds ${THRESHOLDS.totalCssPct}% (${formatBytes(base.totalCssBytes)} -> ${formatBytes(current.totalCssBytes)})`
    );
  }

  console.log('[perf-regression] Summary');
  console.log(`  Baseline: ${path.relative(ROOT, BASELINE_PATH)}`);
  console.log(`  Largest JS: ${formatBytes(base.largestJsChunkBytes)} -> ${formatBytes(current.largestJsChunkBytes)} (${deltas.largestJsPct.toFixed(2)}%)`);
  console.log(`  Total JS: ${formatBytes(base.totalJsBytes)} -> ${formatBytes(current.totalJsBytes)} (${deltas.totalJsPct.toFixed(2)}%)`);
  console.log(`  Total CSS: ${formatBytes(base.totalCssBytes)} -> ${formatBytes(current.totalCssBytes)} (${deltas.totalCssPct.toFixed(2)}%)`);

  if (failures.length > 0) {
    console.error('[perf-regression] Failed regression checks:');
    for (const msg of failures) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  console.log('[perf-regression] All checks passed.');
}

main();
