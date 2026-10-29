import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from '../src/logger.js';

test('events land in JSONL and screenshots are written', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfk-'));
  const log = createLogger(dir);
  log.event({ flow: 'x', step: 0, status: 'ok', ms: 5 });
  const page = { async screenshot({ path: p }) { fs.writeFileSync(p, Buffer.from('89504e47', 'hex')); } };
  const shot = await log.screenshot(page, 'hello');
  const lines = fs.readFileSync(log.file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].status, 'ok');
  assert.ok(lines[0].ts);
  assert.ok(fs.existsSync(shot));
});
