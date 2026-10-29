import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../src/cdp.js';
import { createLogger } from '../src/logger.js';
import { checkUptime, findBrokenLinks } from './scan.js';
import { diffAgainstBaseline } from './diff.js';
import { renderReport } from './report.js';

/**
 * Site Health Auditor CLI — the 40% companion product built on the same engine.
 *   node auditor/cli.js scan sites.json --out reports
 * For each site: uptime check → same-origin broken-link sweep → full-page
 * screenshot → visual diff vs baseline → weekly HTML report (reports/index.html).
 * Exit code 1 when any site is DOWN, so it can gate a cron job.
 */
const [cmd, file, ...args] = process.argv.slice(2);
if (cmd !== 'scan' || !file) {
  console.error('usage: node auditor/cli.js scan <sites.json> [--out reports] [--headful]');
  process.exit(2);
}
const outDir = argValue('--out') ?? 'reports';
const sites = JSON.parse(fs.readFileSync(file, 'utf8')).sites;
fs.mkdirSync(outDir, { recursive: true });

const api = await connect({ headless: !args.includes('--headful') });
const logger = createLogger(path.join(outDir, 'runs'));
const results = [];

for (const site of sites) {
  const page = await api.page();
  const result = { name: site.name, url: site.url, ok: false, status: 0, ms: 0, brokenLinks: [] };
  try {
    Object.assign(result, await checkUptime(page, site.url, site.timeout));
    if (result.ok) result.brokenLinks = await findBrokenLinks(page, { fetchStatus });
    const shot = await logger.screenshot(page, `site-${site.name}`);
    Object.assign(result, diffAgainstBaseline(shot, path.join(outDir, 'baseline', `${site.name}.png`)));
  } catch (err) {
    result.error = String(err?.message ?? err);
  }
  logger.event({ scope: 'audit', ...result });
  results.push(result);
  console.log(`${result.ok ? 'UP  ' : 'DOWN'} ${site.name} (${result.status}, ${result.ms}ms, broken=${result.brokenLinks.length})`);
  await page.close();
}

fs.writeFileSync(path.join(outDir, 'index.html'), renderReport(results));
await api.close();
console.log(`report: ${path.join(outDir, 'index.html')}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);

// Playwright's request API is available on every page — no extra HTTP client needed.
async function fetchStatus(url, timeout) {
  const probe = await api.page();
  try {
    const res = await probe.request.head(url, { timeout });
    if (res.status() === 405) return (await probe.request.get(url, { timeout })).status(); // HEAD unsupported
    return res.status();
  } catch {
    return 0;
  } finally {
    await probe.close();
  }
}

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
