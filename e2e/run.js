import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../src/cdp.js';
import { createLogger } from '../src/logger.js';
import { runFlow } from '../src/runner.js';
import { createFixtureServer } from '../fixtures/serve.js';
import { checkUptime, findBrokenLinks } from '../auditor/scan.js';
import { diffAgainstBaseline } from '../auditor/diff.js';
import { renderReport } from '../auditor/report.js';

/**
 * End-to-end demo (a real Chromium, but only against the local mock site —
 * no external network). Two parts:
 *   1) engine: run the booking flow, then an intentionally failing flow
 *      to prove screenshot evidence + structured logs are captured;
 *   2) auditor: scan the two mock pages, catch the broken link on /about,
 *      diff screenshots against baseline and write reports/index.html.
 * Artifacts: runs/ (JSONL + PNGs), reports/index.html
 */
const { server, baseUrl } = await createFixtureServer();
const api = await connect();
const logger = createLogger('runs');
const hooks = {
  onStep: (s) => logger.event({ flow: 'booking', ...s }),
  onFailure: (i, step) => logger.onFailure(apiPage, 'booking', i),
  onRetry: (r) => logger.event({ flow: 'booking', status: 'retry', ...r }),
};

// --- 1) happy path -----------------------------------------------------------
const flow = JSON.parse(fs.readFileSync('flows/booking.flow.json', 'utf8'));
const apiPage = await api.page();
const summary = await runFlow(apiPage, flow, hooks);
const confirmation = summary.steps.find((s) => s.value)?.value;
console.log('booking flow:', summary.ok, '| confirmation =', confirmation);
fs.mkdirSync('docs', { recursive: true });
fs.copyFileSync('runs/demo-booking-confirmed.png', 'docs/booking-confirmed.png');

// --- failing flow must leave evidence ---------------------------------------
const failing = { name: 'failing', steps: [{ action: 'waitFor', selector: '#does-not-exist', timeout: 1500 }] };
let evidence = null;
try {
  await runFlow(apiPage, failing, { onFailure: (i, step) => logger.onFailure(apiPage, failing.name, i).then((p) => (evidence = p)) });
} catch {
  console.log('failing flow: correctly rejected, evidence =', evidence && path.basename(evidence));
}

// --- 2) auditor on the mock site ---------------------------------------------
const sites = [
  { name: 'home', url: `${baseUrl}/index.html` },
  { name: 'about', url: `${baseUrl}/about.html` },
];
const results = [];
for (const site of sites) {
  const page = await api.page();
  const r = { name: site.name, url: site.url, ok: false, status: 0, ms: 0, brokenLinks: [] };
  try {
    Object.assign(r, await checkUptime(page, site.url));
    r.brokenLinks = await findBrokenLinks(page, { fetchStatus: async (u) => (await page.request.get(u)).status() });
    Object.assign(r, diffAgainstBaseline(await logger.screenshot(page, `site-${site.name}`), `reports/baseline/${site.name}.png`));
  } finally {
    results.push(r);
    await page.close();
  }
}
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/index.html', renderReport(results));
fs.copyFileSync('reports/index.html', 'docs/health-report.html');
const aboutBroken = results.find((r) => r.name === 'about')?.brokenLinks ?? [];
console.log('auditor: about page broken links =', aboutBroken.map((b) => `${b.url} (${b.status})`).join(', '));

await api.close();
server.close();

const pass = !!confirmation && fs.existsSync(evidence ?? '') && aboutBroken.length === 1;
console.log(pass ? 'DEMO OK' : 'DEMO FAILED');
process.exit(pass ? 0 : 1);
