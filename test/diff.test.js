import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { diffAgainstBaseline } from '../auditor/diff.js';

function makePng(w, h, mutate) {
  const png = new PNG({ width: w, height: h });
  png.data.fill(255); // opaque white — pixelmatch ignores fully transparent pixels
  if (mutate) mutate(png);
  return png;
}

test('first run stores baseline, second identical run reports 0%', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfk-diff-'));
  const cur = path.join(dir, 'cur.png');
  const base = path.join(dir, 'sub', 'base.png'); // also covers dir creation
  fs.writeFileSync(cur, PNG.sync.write(makePng(8, 8)));
  assert.deepEqual(diffAgainstBaseline(cur, base), { changed: false, firstRun: true, pct: 0 });
  assert.ok(fs.existsSync(base));
  assert.equal(diffAgainstBaseline(cur, base).pct, 0);
});

test('a changed pixel is detected as a visual change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfk-diff-'));
  const cur = path.join(dir, 'cur.png');
  const base = path.join(dir, 'base.png');
  fs.writeFileSync(base, PNG.sync.write(makePng(8, 8)));
  fs.writeFileSync(cur, PNG.sync.write(makePng(8, 8, (p) => { p.data[0] = 0; p.data[1] = 0; p.data[2] = 0; })));
  const result = diffAgainstBaseline(cur, base, { refresh: false });
  assert.equal(result.changed, true);
  assert.ok(result.pct > 0);
});
