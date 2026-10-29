import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBrokenLinks } from '../auditor/scan.js';
import { createFakePage } from './fake-page.js';

test('flags only same-origin links that return 4xx/5xx', async () => {
  const page = createFakePage({ url: 'http://site.test/' });
  page._state['a[href]'] = {
    links: [
      { getAttribute: () => '/' },                       // same-origin ok
      { getAttribute: () => '/gone' },                   // same-origin 404
      { getAttribute: () => '/gone' },                   // duplicate, deduped
      { getAttribute: () => 'mailto:a@b.co' },           // not http, skipped
      { getAttribute: () => 'https://other.test/x' },    // off-origin, skipped
      { getAttribute: () => '/page#frag' },              // fragment-only path -> /page, ignored
    ],
  };
  const statuses = { 'http://site.test/': 200, 'http://site.test/gone': 404, 'http://site.test/page': 200 };
  const broken = await findBrokenLinks(page, { fetchStatus: async (u) => statuses[u] ?? 500 });
  assert.deepEqual(broken, [{ url: 'http://site.test/gone', status: 404 }]);
});
