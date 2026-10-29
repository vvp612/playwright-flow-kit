/**
 * A tiny in-memory stand-in for a Playwright page, so runner/validate/logger are
 * unit-tested deterministically with no browser and no network.
 */
export function createFakePage({ elements = {}, url = 'http://test/' } = {}) {
  const state = {};
  for (const [sel, v] of Object.entries(elements)) {
    state[sel] = { value: v.value ?? '', text: v.text ?? '', visible: v.visible ?? true, onClick: v.onClick };
  }
  const page = {
    _url: url,
    _state: state,
    url: () => page._url,
    async goto(u) { page._url = u; return { status: 200 }; },
    async isVisible(sel) { return !!state[sel]?.visible; },
    async textContent(sel) { return state[sel] ? state[sel].text : null; },
    async inputValue(sel) { return state[sel] ? state[sel].value : null; },
    async fill(sel, value) { if (!state[sel]) throw new Error('no element ' + sel); state[sel].value = value; },
    async click(sel) { if (!state[sel]) throw new Error('no element ' + sel); const h = state[sel].onClick; if (h) h(page); },
    async waitForSelector(sel) { if (!state[sel]) throw new Error('no element ' + sel); },
    async $$(sel) { return state[sel] ? [{}] : []; },
    async $$eval(sel, fn) { return fn(state[sel] ? state[sel].links ?? [] : []); },
    async screenshot() { return; },
  };
  return page;
}
