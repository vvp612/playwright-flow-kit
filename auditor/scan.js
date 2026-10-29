/**
 * Sweep same-origin links and report which ones return 4xx/5xx.
 * Kept free of Playwright imports so it can be unit-tested with a fake page.
 * `fetchStatus(url)` is injected; in the real CLI it maps to Playwright's request API.
 */
export async function findBrokenLinks(page, { fetchStatus, timeout = 5000 } = {}) {
  const base = new URL(page.url());
  const hrefs = await page.$$eval('a[href]', (els) => els.map((e) => e.getAttribute('href')));
  const seen = new Set();
  const broken = [];

  for (const href of hrefs) {
    let abs;
    try {
      abs = new URL(href, base);
    } catch {
      continue; // mailto:, tel:, javascript: etc.
    }
    if (abs.origin !== base.origin || abs.hash) continue; // same-origin only, ignore #fragments
    const clean = abs.origin + abs.pathname;
    if (seen.has(clean)) continue;
    seen.add(clean);
    const status = await fetchStatus(clean, timeout);
    if (status >= 400) broken.push({ url: clean, status });
  }
  return broken;
}

/** One page load: does it return, and what is its HTTP status? */
export async function checkUptime(page, url, timeout = 10000) {
  const started = Date.now();
  const response = await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
  const status = response ? response.status() : 0;
  return { status, ok: status > 0 && status < 400, ms: Date.now() - started };
}
