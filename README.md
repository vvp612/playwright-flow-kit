# playwright-flow-kit

**Browser-interaction & logging automation on Playwright.** Describe an automation as a
JSON *flow* (goto / click / fill / extract / assert…), run it against a local Chromium or
attach to an already-running one over CDP, and get back structured **JSONL logs plus
screenshot evidence** on every failure — so a run is auditable after the fact, not just
"it worked on my machine".

Comes with a real product built on the same engine — a **Site Health Auditor** that checks
uptime, sweeps for broken links, diffs screenshots against a baseline and writes a weekly
HTML report.

```jsonc
// flows/booking.flow.json — the whole "program"
{
  "name": "booking-demo",
  "baseUrl": "http://127.0.0.1:8971",
  "defaults": { "timeout": 5000, "retries": 1 },
  "steps": [
    { "action": "goto",    "url": "/index.html" },
    { "action": "fill",    "selector": "#name", "value": "Manh Vu" },
    { "action": "click",   "selector": "#submit" },
    { "action": "waitFor", "selector": "#confirm" },
    { "action": "extract", "selector": "#confirm", "name": "confirmation" },
    { "action": "assert",  "selector": "#confirm", "expect": { "textMatch": "BK-[A-Z0-9]{6}" } }
  ]
}
```

## Quick start

```bash
npm install
npx playwright install chromium
npm test        # 9 unit tests — no browser, no network
npm run demo    # real Chromium against the local mock site (see below)
```

`npm run demo` runs everything locally and prints:

```
booking flow: true | confirmation = Confirmed BK-9LWCN0 for Manh Vu
failing flow: correctly rejected, evidence = failing-step0-fail.png
auditor: about page broken links = http://127.0.0.1:8971/prices.html (404)
DEMO OK
```

It leaves artifacts you can open: `runs/run-*.jsonl` (event log),
`runs/screenshots/*.png` (evidence), `reports/index.html` (weekly report).

## The engine (src/)

| Module | Responsibility |
|---|---|
| `cdp.js` | One connection point: `connect({ })` launches Chromium, `connect({ cdpUrl })` attaches over the DevTools protocol. |
| `runner.js` | Executes a flow step-by-step with per-step `retries`, `timeout`, and hooks (`onStep`, `onRetry`, `onFailure`). Throws a `StepError` naming the exact step. |
| `validate.js` | `assert` steps: `visible / text / textMatch / value / count / urlMatch`. Reports every mismatch at once. |
| `logger.js` | JSONL event per step + `screenshot()` and auto `onFailure()` PNG capture. |

Attach to an existing browser instead of launching one:

```js
import { connect } from './src/cdp.js';
import { runFlow } from './src/runner.js';

const chrome = await connect({ cdpUrl: 'http://127.0.0.1:9222' }); // a running Chrome: --remote-debugging-port=9222
const page = await chrome.page();
await runFlow(page, flow, { onStep: (s) => console.log(s) });
```

## The application (auditor/) — a real consumer of the engine

```bash
cp sites.sample.json sites.json   # list the URLs you own
node auditor/cli.js scan sites.json --out reports
```

For each site: uptime check → same-origin broken-link sweep → full-page screenshot →
visual diff vs the stored baseline. Output is a self-contained `reports/index.html`:

| Site | Uptime | Response | Broken links | Visual diff |
|---|---|---|---|---|
| home | UP 200 | 12 ms | none | stable |
| about | UP 200 | 9 ms | `/prices.html → 404` | baseline set |

The CLI exits `1` if any site is down, so it drops straight into a cron or CI job.

## How it's tested

- **Unit** (`node:test`): runner dispatch, retries, validators, logger, link sweep, pixel
  diff and report rendering — a fake page keeps them browser-free and hermetic.
- **E2E** (`npm run demo`): real Chromium on a local mock site (booking + a deliberately
  failing flow + the auditor) — asserts the happy value, the failure evidence and the
  caught broken link. No external websites, so it runs offline.

## Layout
```
src/       engine: cdp, runner, validate, logger
auditor/   site-health product: scan, diff, report, cli
flows/     example flow JSONs
fixtures/  local mock site + static server (for tests/demo)
test/      hermetic unit tests
e2e/       the npm run demo script
docs/      screenshots & a sample report
```

## Status
Core engine, the auditor application, unit tests and the offline E2E demo are all working.
See `PLAN.md` for the roadmap (authenticated sessions, alerting hooks, per-client
baselines) — the next milestones are wired for client-specific integrations.

_Licence: MIT._
