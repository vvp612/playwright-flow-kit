import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../auditor/report.js';

test('report marks a down site and escapes the URL', () => {
  const html = renderReport([
    { name: 'shop', url: 'https://a.test/<script>', ok: false, status: 503, ms: 12, brokenLinks: [], firstRun: true },
  ]);
  assert.match(html, /class="down"/);
  assert.match(html, /DOWN 503/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});
