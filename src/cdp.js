import { chromium } from 'playwright';

/**
 * One connection helper for every flow module.
 * - { cdpUrl }   -> attach to an already-running Chromium (remote debugging port)
 * - { launch }   -> start a private Chromium (default for local runs)
 * Returns { browser, context, page(), close() }.
 */
export async function connect({ cdpUrl, headless = true, args = [], viewport = { width: 1280, height: 800 } } = {}) {
  let browser;
  if (cdpUrl) {
    browser = await chromium.connectOverCDP(cdpUrl);
  } else {
    browser = await chromium.launch({ headless, args });
  }
  const context = await browser.newContext({ viewport });

  return {
    browser,
    context,
    mode: cdpUrl ? 'cdp' : 'launch',
    page: () => context.newPage(),
    close: async () => {
      await context.close();
      // connectOverCDP: disconnect only; launch: shuts the local browser down
      if (!cdpUrl) await browser.close();
      else browser.process()?.kill?.();
    },
  };
}
