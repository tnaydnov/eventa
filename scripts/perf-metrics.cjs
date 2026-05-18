const fs = require('node:fs');
const path = require('node:path');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function collectFilesRecursively(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(ext)) {
        const size = fs.statSync(full).size;
        out.push({ file: full, size });
      }
    }
  }

  return out;
}

function collectBuildMetrics(rootDir) {
  const nextDir = path.join(rootDir, '.next');
  const jsFiles = collectFilesRecursively(path.join(nextDir, 'static', 'chunks'), '.js');
  const cssFiles = collectFilesRecursively(path.join(nextDir, 'static', 'css'), '.css');

  const largestJs = jsFiles.reduce(
    (max, f) => (f.size > max.size ? f : max),
    { file: '-', size: 0 }
  );

  return {
    nextDir,
    jsFiles,
    cssFiles,
    largestJs,
    totalJs: jsFiles.reduce((sum, f) => sum + f.size, 0),
    totalCss: cssFiles.reduce((sum, f) => sum + f.size, 0),
  };
}

module.exports = {
  formatBytes,
  collectBuildMetrics,
};
