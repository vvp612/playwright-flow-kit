export class AssertionError extends Error {
  constructor(step, problems) {
    super(`assert failed${step.selector ? ` at ${step.selector}` : ''}: ${problems.join('; ')}`);
    this.name = 'AssertionError';
    this.problems = problems;
  }
}

function toRegExp(pattern) {
  return pattern instanceof RegExp ? pattern : new RegExp(pattern);
}

/**
 * Evaluate an `assert` step against the live page.
 * `expect` supports: visible, text, textMatch, value, count, urlMatch.
 * Throws AssertionError listing every mismatch at once.
 */
export async function assertPage(page, step) {
  const { selector, expect = {} } = step;
  const problems = [];

  if ('visible' in expect) {
    const visible = await page.isVisible(selector);
    if (visible !== !!expect.visible) problems.push(`visible is ${visible}, expected ${!!expect.visible}`);
  }
  if ('text' in expect) {
    const text = ((await page.textContent(selector)) ?? '').trim();
    if (text !== expect.text) problems.push(`text is "${text}", expected "${expect.text}"`);
  }
  if ('textMatch' in expect) {
    const text = ((await page.textContent(selector)) ?? '').trim();
    if (!toRegExp(expect.textMatch).test(text)) problems.push(`text "${text}" does not match ${expect.textMatch}`);
  }
  if ('value' in expect) {
    const value = (await page.inputValue(selector)) ?? '';
    if (value !== expect.value) problems.push(`value is "${value}", expected "${expect.value}"`);
  }
  if ('count' in expect) {
    const handles = await page.$$(selector);
    if (handles.length !== expect.count) problems.push(`count is ${handles.length}, expected ${expect.count}`);
  }
  if ('urlMatch' in expect) {
    if (!toRegExp(expect.urlMatch).test(page.url())) problems.push(`url "${page.url()}" does not match ${expect.urlMatch}`);
  }

  if (problems.length) throw new AssertionError(step, problems);
}
