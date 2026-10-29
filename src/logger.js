import fs from 'node:fs';
import path from 'node:path';

/**
 * Structured run logger: one JSONL file per run plus screenshot evidence.
 * Every step emits a machine-readable event; failures always capture a PNG,
 * so a finished run is auditable without re-running it.
 */
export function createLogger(runDir) {
  const shotsDir = path.join(runDir, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(runDir, `run-${stamp}.jsonl`);

  return {
    runDir,
    file,
    event(fields) {
      fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...fields }) + '\n');
    },
    async screenshot(page, name) {
      const target = path.join(shotsDir, `${name}.png`);
      await page.screenshot({ path: target, fullPage: true });
      return target;
    },
    async onFailure(page, flowName, stepIndex) {
      const target = path.join(shotsDir, `${flowName}-step${stepIndex}-fail.png`);
      try {
        await page.screenshot({ path: target, fullPage: true });
        return target;
      } catch {
        return null; // page already closed — the JSONL event still has the error
      }
    },
  };
}
