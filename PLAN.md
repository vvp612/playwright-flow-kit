# PLAN — playwright-flow-kit

Engineering plan behind the project: what is being built, in which order, and how each
part is verified.

## 1. Goals
- A small, dependable **flow engine** on top of Playwright: automation described as JSON,
  executed with per-step retries, timeouts, validation and machine-readable logs.
- Every run is **auditable afterwards**: JSONL event log + screenshot evidence on failure,
  so a failed automation can be diagnosed without re-running it.
- A **single connection point** (local launch or attach over CDP to an already-running
  Chromium) shared by every module and product built on top.
- Ship one real product on the engine to prove it generalises: the **Site Health Auditor**
  with weekly HTML reports.

## 2. Architecture
```
flow.json ─┐
           ▼
   runner.js ──uses── cdp.js (1 browser, N contexts)
      │  validate.js (per-step asserts)
      └── logs ── logger.js → run-<ts>.jsonl + screenshots/*.png
audit ── auditor/cli.js → scan.js → diff.js → report.js → reports/index.html
```
- `src/{cdp,runner,validate,logger}.js` — the engine.
- `auditor/{scan,diff,report,cli}.js` — the flagship application.
- `fixtures/booking-site/` — local mock site for flows, tests and demos (no external sites).
- `flows/` — example flow definitions.

## 3. Milestones
- **M1 — core**: `cdp.js` + `runner.js` execute a `{goto, click, fill, extract}` flow on the
  fixture site. *Done when:* `npm run demo` prints the extracted booking code.
- **M2 — validate + retry**: schema asserts and retry/timeout. *Done when:* unit tests pass
  (assert mismatch detected; a flaky step recovers on attempt 2).
- **M3 — logger + evidence**: JSONL + screenshot-on-fail. *Done when:* an intentionally
  failing flow leaves a log file and a PNG.
- **M4 — auditor scan**: uptime check + same-origin broken-link sweep. *Done when:* the
  fixture's known-broken link is reported.
- **M5 — diff + weekly report**: pixelmatch baseline diff; `reports/index.html`. *Done
  when:* diffing two different PNGs yields % > 0 and the report renders.
- **M6 — CLI + docs + demo assets**: README with screenshots. *Done when:* `npm test` green.

## 4. Test strategy
- Unit (`node:test`, no browser, no network): step dispatch through a seeded fake page;
  validators; retry behaviour; logger output; link-sweep parsing; pixel diff on generated
  PNGs; report escaping.
- E2E (`npm run demo`): real Chromium against the local fixture site — happy flow with
  extracted value, failing flow with captured evidence, auditor catching a broken link.
- No external websites are required for tests or the demo.

## 5. Demo assets (in README)
- `docs/booking-confirmed.png` — the fixture site after a successful booking flow.
- `docs/health-report.html` — a generated weekly health report.

## 6. Deployment & cost
- CLI tool; runs locally or on a schedule (cron/CI). Dependencies: `playwright`,
  `pixelmatch`, `pngjs`. Runtime cost: $0 (local browser).

## 7. Roadmap (client-specific work, intentionally not bundled)
- Site-specific adapters: authenticated sessions, rate-limited crawling, pop-up handling.
- Alerting hooks (email/webhook) on DOWN links for monitoring-grade SLAs.
- Per-client baselines kept in object storage instead of a local directory.
- Packaging as a reusable npm module once a second consumer lands.

## 8. Definition of Done
All tests green; README opens with what the tool does and shows a real run; demo assets
present; failing-run evidence demonstrably produced; clean commit history.
