import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Compare a new full-page screenshot against the stored baseline.
 * Returns { changed: boolean, pct, reason? } and refreshes the baseline when
 * the site visually changed (so the next week compares against "now").
 */
export function diffAgainstBaseline(currentPath, baselinePath, { threshold = 0.1, refresh = true } = {}) {
  if (!fs.existsSync(baselinePath)) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.copyFileSync(currentPath, baselinePath);
    return { changed: false, firstRun: true, pct: 0 };
  }
  const current = PNG.sync.read(fs.readFileSync(currentPath));
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  if (current.width !== baseline.width || current.height !== baseline.height) {
    if (refresh) fs.copyFileSync(currentPath, baselinePath);
    return { changed: true, pct: 100, reason: 'page size changed' };
  }
  const diff = new PNG({ width: current.width, height: current.height });
  const diffPixels = pixelmatch(current.data, baseline.data, diff.data, current.width, current.height, { threshold });
  const pct = Number(((diffPixels / (current.width * current.height)) * 100).toFixed(2));
  if (pct > 0 && refresh) fs.copyFileSync(currentPath, baselinePath);
  return { changed: pct > 0, pct };
}
