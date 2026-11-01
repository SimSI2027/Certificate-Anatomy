import { expect } from '@playwright/test';

/** Open the app and collect console errors. */
export async function openApp(page, url = '/') {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ca && window.__ca.settled());
  return errors;
}

export async function settle(page) {
  await page.waitForFunction(() => window.__ca.settled(), null, { timeout: 10000 });
}

export const node = (page, id) => page.locator(`[data-node="${id}"]`);

export async function clickNode(page, id) {
  await node(page, id).click();
  await settle(page);
}

export const state = (page) => page.evaluate(() => window.__ca.state);

export async function rectOf(page, id) {
  return node(page, id).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
}

export async function expectInspector(page, title) {
  await expect(page.locator('.inspector')).toBeVisible();
  await expect(page.locator('.insp-title')).toHaveText(title);
}
