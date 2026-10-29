import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFlow, StepError } from '../src/runner.js';
import { createFakePage } from './fake-page.js';

test('runs happy path and captures extracted value', async () => {
  const page = createFakePage({ elements: { '#name': {}, '#out': { text: 'BK-42' } } });
  const flow = {
    name: 'extract', defaults: { retries: 0 },
    steps: [
      { action: 'fill', selector: '#name', value: 'hi' },
      { action: 'extract', selector: '#out', name: 'code' },
    ],
  };
  const summary = await runFlow(page, flow);
  assert.equal(summary.ok, true);
  assert.equal(summary.steps[1].value, 'BK-42');
});

test('retry recovers when a step fails once', async () => {
  let tries = 0;
  const page = createFakePage({ elements: { '#submit': { onClick: () => { if (++tries < 2) throw new Error('flaky'); } } } });
  const flow = { name: 'flaky', defaults: { retryDelay: 0 }, steps: [{ action: 'click', selector: '#submit', retries: 1 }] };
  const summary = await runFlow(page, flow);
  assert.equal(summary.ok, true);
  assert.equal(summary.steps[0].attempts, 2);
});

test('assert mismatch fails the flow with StepError', async () => {
  const page = createFakePage({ elements: { '#out': { text: 'nope' } } });
  const flow = { name: 'a', steps: [{ action: 'assert', selector: '#out', expect: { textMatch: '^BK-' } }] };
  await assert.rejects(() => runFlow(page, flow), StepError);
});

test('exhausted retries invoke onFailure hook', async () => {
  const page = createFakePage({ elements: {} });
  let failedAt = null;
  const flow = { name: 'f', steps: [{ action: 'click', selector: '#missing', retries: 2 }] };
  await assert.rejects(
    () => runFlow(page, flow, { onFailure: (i) => { failedAt = i; } }),
    StepError,
  );
  assert.equal(failedAt, 0);
});
