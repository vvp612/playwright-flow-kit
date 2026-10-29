import { assertPage } from './validate.js';

/**
 * Execute a single step against a Playwright-compatible page.
 * Supported actions: goto, click, fill, waitFor, extract, assert, screenshot, sleep.
 * Returns the extracted value for `extract` steps, otherwise undefined.
 */
export async function execStep(page, step, flow) {
  const timeout = step.timeout ?? flow.defaults?.timeout ?? 5000;
  const url = flow.baseUrl && step.url && !/^https?:/.test(step.url) ? flow.baseUrl + step.url : step.url;

  switch (step.action) {
    case 'goto':
      await page.goto(url, { timeout, waitUntil: step.waitUntil ?? 'load' });
      return;
    case 'click':
      await page.click(step.selector, { timeout });
      return;
    case 'fill':
      await page.fill(step.selector, step.value ?? '', { timeout });
      return;
    case 'waitFor':
      await page.waitForSelector(step.selector, { timeout, state: step.state ?? 'visible' });
      return;
    case 'extract':
      return (await page.textContent(step.selector))?.trim();
    case 'assert':
      await assertPage(page, step);
      return;
    case 'screenshot':
      await page.screenshot({ path: step.path ?? `evidence-${step.name ?? 'shot'}.png`, fullPage: step.fullPage ?? true });
      return;
    case 'sleep':
      await new Promise((r) => setTimeout(r, step.ms ?? 100));
      return;
    default:
      throw new Error(`unknown action: ${step.action}`);
  }
}

export class StepError extends Error {
  constructor(index, step, cause) {
    super(`step ${index} (${step.action}${step.selector ? ' ' + step.selector : ''}) failed: ${cause?.message ?? cause}`);
    this.name = 'StepError';
    this.index = index;
    this.step = step;
    this.cause = cause;
  }
}

/**
 * Run a flow: an ordered list of steps with per-step retries.
 * `hooks.onStep({ index, step, status, attempts, error })` receives every outcome;
 * `hooks.onFailure(index, step)` can capture screenshot evidence.
 * Resolves with a summary; rejects on the first step that exhausts its retries.
 */
export async function runFlow(page, flow, hooks = {}) {
  const summary = { name: flow.name, ok: true, steps: [] };
  for (let index = 0; index < flow.steps.length; index++) {
    const step = flow.steps[index];
    const maxAttempts = 1 + (step.retries ?? flow.defaults?.retries ?? 0);
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const value = await execStep(page, step, flow);
        const record = { index, action: step.action, status: 'ok', attempts: attempt };
        if (step.name && value !== undefined) record.value = value;
        summary.steps.push(record);
        hooks.onStep?.(record);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          hooks.onRetry?.({ index, step, attempt, error: err });
          await new Promise((r) => setTimeout(r, flow.defaults?.retryDelay ?? 0));
        }
      }
    }

    if (lastError) {
      await hooks.onFailure?.(index, step);
      const wrapped = new StepError(index, step, lastError);
      hooks.onStep?.({ index, action: step.action, status: 'failed', error: wrapped.message });
      summary.ok = false;
      summary.steps.push({ index, action: step.action, status: 'failed' });
      throw Object.assign(wrapped, { summary });
    }
  }
  return summary;
}
