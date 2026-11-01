import { test, expect } from '@playwright/test';
import { openApp, settle, node, clickNode, state, rectOf, expectInspector } from './helpers.js';

test.describe('certificate anatomy', () => {
  test('loads without console errors and opens with the signed certificate', async ({ page }) => {
    const errors = await openApp(page);
    await expect(page.getByText('How did all of these fields come together?')).toBeVisible();
    await expect(node(page, 'cert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the certificate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch how it was created' })).toBeVisible();
    expect((await state(page)).playing).toBe(false); // no autoplay
    expect(errors).toEqual([]);
  });

  test('explodes, opens extensions, inspects SAN, issuer and signature, then reassembles exactly', async ({ page }) => {
    const errors = await openApp(page);
    const before = await rectOf(page, 'cert');
    await clickNode(page, 'cert');
    expect((await state(page)).cert.exploded).toBe(true);
    await expect(node(page, 'cert.tbs')).toBeVisible();
    await expect(node(page, 'cert.sigValue')).toBeVisible();

    await clickNode(page, 'cert.tbs');
    await clickNode(page, 'cert.tbs.extensions');
    await expect(node(page, 'cert.ext.san')).toBeVisible();
    await expect(node(page, 'cert.tbs.extensions')).toHaveAttribute('aria-expanded', 'true');

    await clickNode(page, 'cert.ext.san');
    await expectInspector(page, 'Subject Alternative Name');
    await expect(page.locator('.inspector')).toContainText('www.app.simsi2027.test');

    await clickNode(page, 'cert.tbs.issuer');
    await expectInspector(page, 'Issuer');
    await expect(page.locator('.inspector')).toContainText('Not the Root CA');

    await clickNode(page, 'cert.sigValue');
    await expectInspector(page, 'Certificate Signature Value');
    await expect(page.locator('.inspector')).toContainText('Issuing CA private key');

    // Escape hierarchy: explanation, child structure, whole artifact.
    await page.keyboard.press('Escape'); await settle(page);
    await expect(page.locator('.inspector')).toBeHidden();
    await page.keyboard.press('Escape'); await settle(page);
    expect((await state(page)).cert.open).toEqual(['cert.tbs']);
    await page.keyboard.press('Escape'); await settle(page);
    await page.keyboard.press('Escape'); await settle(page);
    expect((await state(page)).cert.exploded).toBe(false);
    expect(await rectOf(page, 'cert')).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('clicking the exploded artifact header reassembles it', async ({ page }) => {
    await openApp(page);
    const before = await rectOf(page, 'cert');
    await clickNode(page, 'cert');
    await clickNode(page, 'cert.tbs');
    await clickNode(page, 'cert');
    expect((await state(page)).cert.exploded).toBe(false);
    expect(await rectOf(page, 'cert')).toEqual(before);
  });

  test('clicking outside the active object steps back', async ({ page }) => {
    await openApp(page);
    await clickNode(page, 'cert');
    await clickNode(page, 'cert.tbs');
    await page.mouse.click(20, 450); // empty studio floor, left gutter
    await settle(page);
    expect((await state(page)).selected).toBeNull();
  });

  test('traces fields back to the request', async ({ page }) => {
    await openApp(page);
    await clickNode(page, 'cert');
    await page.getByRole('button', { name: 'Trace back to request' }).click();
    await settle(page);
    await expect(page.locator('.legend')).toBeVisible();
    await expect(node(page, 'cert.ext.aia')).toContainText('CA config');
    await expect(node(page, 'cert.tbs.serial')).toContainText('Added by CA');
    await page.locator('.chip[data-cat="config"]').click();
    expect((await state(page)).traceFilter).toBe('config');
  });

  test('shows the encoded bytes as hex, Base64 and PEM', async ({ page }) => {
    await openApp(page);
    await clickNode(page, 'cert');
    await page.getByRole('button', { name: 'PEM' }).click();
    await settle(page);
    await expect(page.locator('[data-node="enc.cert.pem"]')).toContainText('-----BEGIN CERTIFICATE-----');
    await page.getByRole('button', { name: 'DER hex' }).click();
    await settle(page);
    await expect(page.locator('[data-node="enc.cert.hex"] .enc-bytes')).toContainText('30 82');
    await page.keyboard.press('Escape'); await settle(page);
    expect((await state(page)).encoding).toBe('structure');
  });
});

test.describe('CSR anatomy', () => {
  test('explodes the CSR, shows public key, CSR signature and retained private key', async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => window.__ca.dispatch({ type: 'goStep', step: 3 }));
    await settle(page);
    await expect(node(page, 'csr.privateKey')).toBeVisible();
    const before = await rectOf(page, 'csr');
    await clickNode(page, 'csr');
    await clickNode(page, 'csr.cri');
    await clickNode(page, 'csr.cri.spki');
    await clickNode(page, 'csr.cri.spki.publicKey');
    await expectInspector(page, 'Public Key');
    await expect(page.locator('.fp-compare .eq')).toContainText('Identical');

    await clickNode(page, 'csr.sigValue');
    await expectInspector(page, 'Signature Value');
    await expect(page.locator('.inspector')).toContainText('Proof of possession');
    await expect(page.locator('.inspector')).toContainText('not copied into the certificate');

    await clickNode(page, 'csr.privateKey');
    await expectInspector(page, 'APP01 private key');
    await expect(page.locator('.inspector')).toContainText('never inside the CSR');
    await expect(page.locator('.inspector')).toContainText('No. It stays on APP01.');

    await clickNode(page, 'csr.cri');
    await clickNode(page, 'csr.cri.attributes');
    await clickNode(page, 'csr.attr.extReq');
    await expect(node(page, 'csr.ext.san')).toBeVisible();
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await settle(page); if (!(await state(page)).csr.exploded) break; }
    expect((await state(page)).csr.exploded).toBe(false);
    expect(await rectOf(page, 'csr')).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('compare mode traces backward and forward', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await settle(page);
    await expect(page.locator('[data-node="cmp.head.csr"]')).toBeVisible();
    await clickNode(page, 'cert.tbs.serial');
    await expect(page.locator('.inspector')).toContainText('Created by CA');
    await clickNode(page, 'csr.ext.san');
    await expect(page.locator('.inspector')).toContainText('Requested, then approved by CA');
    const paths = await page.locator('.links path').count();
    expect(paths).toBeGreaterThan(10);
  });
});

test.describe('manual issuance', () => {
  test('plays, pauses, steps and reaches installed and verified', async ({ page }) => {
    const errors = await openApp(page);
    await page.getByRole('button', { name: 'Watch how it was created' }).click();
    let s = await state(page);
    expect(s.scene).toBe('flow');
    expect(s.playing).toBe(true);
    await expect(page.locator('[data-node="flow.cmd.created"]')).toContainText('Shown for learning; never executed by this simulator.');
    await page.getByRole('button', { name: 'Pause' }).click();
    expect((await state(page)).playing).toBe(false);

    await page.getByRole('button', { name: 'Next' }).click(); await settle(page);
    expect((await state(page)).flowStage).toBe(1);
    await expect(page.locator('[data-node="flow.carry"]')).toContainText('Public request data only');
    await page.getByRole('button', { name: 'Previous' }).click(); await settle(page);
    expect((await state(page)).flowStage).toBe(0);

    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next' }).click(); await settle(page); }
    expect((await state(page)).flowStage).toBe(3);
    await expect(page.locator('[data-node="flow.newcert"]')).toContainText('separate structure');
    await expect(page.locator('[data-node="flow.seal"]')).toContainText('Issuing CA private key');
    await expect(page.locator('[data-node="flow.root"]')).toContainText('offline');

    await page.getByRole('button', { name: 'Next' }).click(); await settle(page);
    await page.getByRole('button', { name: 'Next' }).click(); await settle(page);
    await expect(page.locator('[data-node="flow.store"]')).toContainText('Personal');
    await page.getByRole('button', { name: 'Next' }).click(); await settle(page);
    await expect(page.locator('[data-node="flow.match"]')).toContainText('Identical');
    await page.getByRole('button', { name: 'Next' }).click(); await settle(page);
    await expect(page.locator('[data-node="flow.done"]')).toHaveText('INSTALLED AND VERIFIED');
    for (const label of ['Inspect certificate again', 'Inspect CSR again', 'Replay issuance', 'Compare CSR and certificate']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    // The APP01 key never left the APP01 zone.
    const key = await rectOf(page, 'flow.key');
    const lane = await rectOf(page, 'flow.zone.lane');
    expect(key.x + key.w).toBeLessThan(lane.x);
    expect(errors).toEqual([]);
  });
});

test.describe('keyboard, motion and layout', () => {
  test('keyboard alone can explode, open and inspect', async ({ page }) => {
    await openApp(page);
    await node(page, 'cert').focus();
    await page.keyboard.press('Enter'); await settle(page);
    expect((await state(page)).cert.exploded).toBe(true);
    await node(page, 'cert.tbs').focus();
    await page.keyboard.press('Enter'); await settle(page);
    await node(page, 'cert.tbs.serial').focus();
    await page.keyboard.press('Space'); await settle(page);
    await expectInspector(page, 'Serial Number');
    await page.keyboard.press('Escape'); await settle(page);
    await expect(node(page, 'cert.tbs.serial')).toBeFocused();
  });

  test('reduced motion settles immediately', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await openApp(page, 'http://127.0.0.1:5173/');
    await node(page, 'cert').click();
    expect(await page.evaluate(() => window.__ca.settled())).toBe(true);
    await expect(page.getByRole('button', { name: 'Reduced motion' })).toHaveAttribute('aria-pressed', 'true');
    await ctx.close();
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844]]) {
    test(`responsive layout at ${w}x${h} has no horizontal scroll`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = await openApp(page, 'http://127.0.0.1:5173/');
      await clickNode(page, 'cert');
      await clickNode(page, 'cert.tbs');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      const r = await rectOf(page, 'cert.tbs.serial');
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }

  test('files dialog offers public downloads only, and native viewer is local-only', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Files' }).click();
    const links = page.locator('[data-download]');
    expect(await links.count()).toBeGreaterThanOrEqual(8);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('download')));
    for (const f of hrefs) expect(f).not.toMatch(/\.(key|pfx|p12)$/);
    await expect(page.locator('.dialog')).toContainText('available when you run Certificate Anatomy locally');
    await expect(page.locator('[data-native-viewer]')).toHaveCount(0);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download="leaf-cer"]').click()]);
    expect(download.suggestedFilename()).toBe('app-simsi2027-test.cer');
  });

  test('native viewer button appears only with a valid local companion fragment', async ({ page }) => {
    await openApp(page, `/#companion=47615&token=${'t'.repeat(43)}`);
    await page.getByRole('button', { name: 'Files' }).click();
    await expect(page.locator('[data-native-viewer]')).toHaveCount(1);
  });
});

test.describe('film and public build', () => {
  test('film page exposes a deterministic renderAt', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/film.html?capture');
    await page.waitForFunction(() => window.filmReady === true);
    await page.evaluate(() => window.renderAt(30.5));
    const shot1 = await page.screenshot();
    await page.evaluate(() => window.renderAt(50)); // visit a distant frame
    await page.evaluate(() => window.renderAt(30.5));
    expect((await page.screenshot()).equals(shot1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('works under the GitHub Pages repository subpath', async ({ page }) => {
    const errors = await openApp(page, 'http://127.0.0.1:4173/Certificate-Anatomy/');
    await clickNode(page, 'cert');
    await expect(node(page, 'cert.tbs')).toBeVisible();
    await page.getByRole('button', { name: 'Files' }).click();
    const href = await page.locator('[data-download="leaf-cer"]').getAttribute('href');
    expect(href).toMatch(/^\/Certificate-Anatomy\/assets\//);
    const res = await page.request.get(`http://127.0.0.1:4173${href}`);
    expect(res.status()).toBe(200);
    const film = await page.request.get('http://127.0.0.1:4173/Certificate-Anatomy/film.html');
    expect(film.status()).toBe(200);
    expect(errors).toEqual([]);
  });
});
