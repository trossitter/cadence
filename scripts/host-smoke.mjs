// Smoke test for the Cadence demo host harness.
//
// Assumes the remote (federation preview) and host (:4201) are already running:
//   Terminal A:  nx build @org/wc && nx preview @org/wc      # remote -> :4200
//   Terminal B:  nx serve @org/host                          # host   -> :4201
//   Terminal C:  node scripts/host-smoke.mjs
//
// Proves: (1) the federated CadenceRoot mounted inside the host, and
//         (2) the remote's compiled CSS loaded (no "unstyled remote" regression).
// Override the host URL with HOST_URL=...
import { chromium } from '@playwright/test';

const HOST_URL = process.env.HOST_URL ?? 'http://localhost:4201';
const TIMEOUT = 20000;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

try {
  console.log(`→ opening ${HOST_URL}`);
  await page.goto(HOST_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

  // 1. Host chrome rendered.
  await page.waitForSelector('.host-bar', { timeout: TIMEOUT });
  console.log('✓ host shell rendered');

  // 2. Federated remote mounted — Cadence-owned content inside the host stage.
  const brand = page.locator('.host-stage').getByText('Cadence', { exact: true }).first();
  await brand.waitFor({ timeout: TIMEOUT });
  await page.getByRole('button', { name: 'Contributor' }).waitFor({ timeout: TIMEOUT });
  await page.getByRole('button', { name: 'Director' }).waitFor({ timeout: TIMEOUT });
  console.log('✓ Cadence remote mounted (brand + workspace toggle visible)');

  // 3. Remote CSS loaded — the eyebrow uses Tailwind text-slate-500; with no CSS
  //    it falls back to default black.
  const color = await brand.evaluate((el) => getComputedStyle(el).color);
  if (color === 'rgb(0, 0, 0)' || color === 'rgba(0, 0, 0, 0)') {
    fail(`remote CSS not applied (brand color is ${color})`);
  } else {
    console.log(`✓ remote CSS applied (brand color ${color})`);
  }

  // 4. The stylesheet link the host injects is present.
  const styleHref = await page.getAttribute('#cadence-remote-styles', 'href');
  if (!styleHref) {
    fail('remote stylesheet link was not injected');
  } else {
    console.log(`✓ remote stylesheet linked (${styleHref})`);
  }

  if (consoleErrors.length) {
    console.warn(`! ${consoleErrors.length} console error(s):`);
    consoleErrors.slice(0, 5).forEach((e) => console.warn(`  - ${e}`));
  }
} catch (err) {
  fail(`smoke failed: ${err.message}`);
} finally {
  await browser.close();
}

console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
