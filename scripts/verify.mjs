#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startHarness } from './harness.mjs';

const zipPath = process.argv[2];
if (!zipPath || !existsSync(zipPath)) {
    console.error('usage: node scripts/verify.mjs <zip>');
    process.exit(2);
}

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('playwright not installed, run: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'js13k-verify-'));
execFileSync('unzip', ['-q', zipPath, '-d', dir]);

const failures = [];
const indexPath = join(dir, 'index.html');
if (!existsSync(indexPath)) {
    failures.push('no index.html at the zip root');
}

if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf8');
    const open = (html.match(/<script\b/gi) || []).length;
    const close = (html.match(/<\/script\s*>/gi) || []).length;
    if (open !== close) {
        failures.push(`${open} <script> tags but ${close} closing tags, an unterminated inline script is parsed but NEVER executed`);
    }
}

const harness = await startHarness(dir);
const url = harness.url;

const browser = await chromium.launch();
const page = await browser.newPage();

const pageErrors = [], consoleErrors = [], badRequests = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) {
        badRequests.push(`${r.status()} ${r.url()}`);
    }
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const state = await page.evaluate(() => ({
    scripts: document.scripts.length,
    inlineBytes: [...document.scripts].reduce((n, s) => n + s.textContent.length, 0),
    canvasPainted: [...document.querySelectorAll('canvas')].some((c) => {
        const ctx = c.getContext('2d');
        if (!ctx) return true;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 997) {
            if (d[i]) return true;
        }
        return false;
    }),
}));
const domWithJs = await page.content();

const inertContext = await browser.newContext({ javaScriptEnabled: false });
const inertPage = await inertContext.newPage();
await inertPage.goto(url, { waitUntil: 'load' });
const domWithoutJs = await inertPage.content();
await inertContext.close();

if (pageErrors.length) {
    failures.push(`uncaught exception: ${pageErrors[0]}`);
}
if (consoleErrors.length) {
    failures.push(`console error: ${consoleErrors[0]}`);
}
if (badRequests.length) {
    failures.push(`failed request: ${badRequests[0]}`);
}
const touchedDom = domWithJs !== domWithoutJs;
if (!touchedDom && !state.canvasPainted) {
    failures.push('DOM is byte-identical to a JavaScript-disabled load and no canvas was painted, the scripts are present but did nothing');
}

await browser.close();
await harness.close();

console.log(`  ${state.scripts} script element(s), ${state.inlineBytes} inline bytes, `
    + `dom-changed=${touchedDom}, canvas-painted=${state.canvasPainted}`);
if (failures.length) {
    console.log(`\x1b[91m\x1b[1m[DEAD] ${zipPath}\x1b[39m`);
    for (const f of failures) {
        console.log(`  - ${f}`);
    }
    process.exit(1);
}
console.log(`\x1b[92m\x1b[1m[BOOTS] ${zipPath} runs in Chromium\x1b[39m`);
