import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = process.env.LUNAR_PLAYWRIGHT ? await import(pathToFileURL(process.env.LUNAR_PLAYWRIGHT).href) : await import('playwright');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>
:root{--SmartThemeBodyColor:#d8d9e2;--SmartThemeQuoteColor:#daa45e;--SmartThemeBorderColor:#46404c;--SmartThemeBlurTintColor:rgba(20,18,25,.9);--SmartThemeChatTintColor:rgba(20,18,25,.8)}
body{margin:0;padding:30px;color:var(--SmartThemeBodyColor);font:15px/1.45 system-ui;background:radial-gradient(ellipse at 0 0,#19203a,transparent 70%),linear-gradient(150deg,#0a0b17,#1a1228);min-height:100vh;box-sizing:border-box}
main{max-width:680px;margin:auto;padding:18px;background:var(--SmartThemeBlurTintColor);border:1px solid var(--SmartThemeBorderColor);border-radius:12px}.inline-drawer-header{padding:6px;border:1px solid var(--SmartThemeBorderColor);border-radius:8px}button,select{font:inherit;color:inherit;background:var(--SmartThemeBlurTintColor);border:1px solid var(--SmartThemeBorderColor);border-radius:5px;padding:5px}small{opacity:.8}h1{font-size:18px;margin:0 0 15px}.lunar-ui p{font-size:13px}fieldset p{margin-bottom:0}
</style></head><body><main class="drawer-content"><h1>LunarUI · night profiles</h1><div id="extensions_settings"></div></main>
<nav id="top-settings-holder">Navigation</nav><form id="send_form"><textarea id="send_textarea"></textarea></form><dialog class="popup" open>Fixture dialog</dialog><div id="chat" style="margin-top:25px;height:180px"><input id="draft" value="fixture input"><img id="art" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E"></div>
<script type="module">import {mountUI} from '/modules/ui/index.js';window.saves=0;window.ctx={extensionSettings:{LunarCore:{ui:JSON.parse(sessionStorage.getItem('uiFixture')||'{}'),debug:{capacity:5000}}},saveSettingsDebounced(){saves++;sessionStorage.setItem('uiFixture',JSON.stringify(this.extensionSettings.LunarCore.ui))}};window.disposeUI=mountUI(document.getElementById('extensions_settings'),ctx);</script></body></html>`;
const server = http.createServer(async (req, res) => {
    try {
        const pathname = new URL(req.url, 'http://fixture').pathname;
        if (pathname === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(fixture); return; }
        const filename = path.resolve(root, '.' + decodeURIComponent(pathname));
        if (!filename.startsWith(root + path.sep) || !/\.(js|css)$/.test(filename)) { res.writeHead(404); res.end(); return; }
        res.setHeader('content-type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(filename));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1100 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('.lunar-ui > summary').click();
    assert.equal(await page.locator('[data-moonlight]').isChecked(), false);
    assert.equal(await page.locator('[data-ui-effects]').isChecked(), false);
    await page.locator('[data-ui-profile]').selectOption('twilight');
    assert.equal(await page.locator('[data-ui-opacity]').inputValue(), '58');
    await page.locator('[data-moonlight]').check();
    assert.equal(await page.evaluate(() => document.body.classList.contains('lunar-twilight')), true);
    await page.locator('[data-ui-opacity]').evaluate(node => { node.value = 46; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-ui-profile]').selectOption('moonlight');
    assert.equal(await page.locator('[data-ui-opacity]').inputValue(), '82');
    await page.locator('[data-ui-profile]').selectOption('twilight');
    assert.equal(await page.locator('[data-ui-opacity]').inputValue(), '46');
    await page.locator('[data-ui-effects]').check(); await page.locator('[data-ui-breathing]').check();
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient-visible').length > 0);
    const baseCount = await page.locator('.lunar-ambient').count();
    assert.equal(baseCount, 7);
    assert.equal(await page.locator('#chat .lunar-ambient').count(), 0);
    assert.equal(await page.locator('.lunar-ambient').first().evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    await page.locator('[data-ui-intensity]').evaluate(node => { node.value = 65; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-ui-speed]').evaluate(node => { node.value = 0.5; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--lunar-twinkle-time')), '20s');
    const starDuration = await page.locator('.lunar-star').first().evaluate(node => getComputedStyle(node).animationDuration);
    assert.equal(starDuration, '20s');
    await page.locator('[data-ui-twinkles]').uncheck();
    assert.equal(await page.locator('.lunar-star').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.locator('[data-ui-twinkles]').check();
    // Local controls affect only the selected area, survive reload, and never enter chat/form DOM.
    await page.locator('[data-ui-area]').selectOption('chat');
    assert.equal(await page.locator('[data-area-twinkles]').inputValue(), '25');
    await page.locator('[data-area-twinkles]').evaluate(node => { node.value = 0; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('[data-lunar-area="chat"] .lunar-star').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.notEqual(await page.locator('[data-lunar-area="settings"] .lunar-star').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.locator('[data-area-speed]').evaluate(node => { node.value = 2; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('[data-lunar-area="chat"] .lunar-sheen').evaluate(node => getComputedStyle(node).animationDuration), '18s');
    await page.locator('[data-area-enabled]').uncheck();
    assert.equal(await page.locator('[data-lunar-area="chat"]').count(), 0);
    await page.locator('[data-area-enabled]').check();
    assert.equal(await page.locator('#send_form .lunar-ambient').count(), 0);
    await page.evaluate(() => document.getElementById('chat').style.width = '250px');
    await page.locator('#chat').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-lunar-area="chat"]').getBoundingClientRect().width - 250) < 1);
    // The native dialog keeps its fixed/absolute layout; an overlay never repositions it.
    assert.notEqual(await page.locator('dialog.popup').evaluate(node => getComputedStyle(node).position), 'relative');
    // New extension headers are decorated once without reading any label.
    await page.evaluate(() => { const header = document.createElement('div'); header.className = 'inline-drawer-header'; header.id = 'late-header'; header.textContent = 'Another extension'; document.getElementById('extensions_settings').append(header); });
    await page.waitForFunction(() => document.querySelectorAll('#late-header > .lunar-ambient').length === 1);
    await page.evaluate(() => document.getElementById('late-header').remove());
    await page.evaluate(() => {
        const group = document.createElement('section'); group.id = 'many-headers';
        for (let i = 0; i < 100; i++) { const header = document.createElement('div'); header.className = 'inline-drawer-header'; group.append(header); }
        document.getElementById('extensions_settings').append(group);
    });
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient').length === 80);
    await page.evaluate(() => document.getElementById('many-headers').remove());
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient').length === 7);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient').length === 0);
    assert.ok((await page.locator('[data-ui-status]').textContent()).includes('reduced motion'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient').length === 7);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.locator('.lunar-star').first().evaluate(node => getComputedStyle(node).animationPlayState), 'paused');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-twilight.png'), fullPage: true });
    await page.reload(); await page.locator('.lunar-ui > summary').click();
    assert.equal(await page.locator('[data-ui-profile]').inputValue(), 'twilight');
    assert.equal(await page.locator('[data-ui-opacity]').inputValue(), '46');
    assert.equal(await page.locator('[data-ui-effects]').isChecked(), true);
    await page.locator('[data-ui-area]').selectOption('chat');
    assert.equal(await page.locator('[data-area-twinkles]').inputValue(), '0');
    assert.equal(await page.locator('[data-area-speed]').inputValue(), '2');
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 5000);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.lunar-ambient-local')].every(node => node.clientWidth <= innerWidth));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => document.documentElement.style.setProperty('--SmartThemeQuoteColor', '#daad66'));
    await page.locator('[data-moonlight]').uncheck();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--SmartThemeQuoteColor').trim()), '#daad66');
    assert.equal(await page.evaluate(() => document.body.classList.contains('lunar-idle-effects')), true); // Independent of recoloring.
    assert.equal(await page.locator('#draft').inputValue(), 'fixture input');
    // Native-shaped layout: effects remain visible after the Extensions drawer closes.
    await page.locator('[data-ui-intensity]').evaluate(node => { node.value = 35; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-area-twinkles]').evaluate(node => { node.value = 25; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => {
        const sheld = document.createElement('div'); sheld.id = 'sheld';
        sheld.style.cssText = 'position:fixed;left:30px;top:50px;width:300px;height:600px;display:flex;flex-direction:column;overflow:hidden;transform:translateZ(0);background:#101522;z-index:30';
        const chat = document.getElementById('chat'); chat.style.cssText = 'flex:1;overflow:auto;z-index:30;backdrop-filter:blur(10px);background:#101522';
        const form = document.createElement('div'); form.id = 'form_sheld'; form.style.cssText = 'position:relative;z-index:30';
        form.append(document.getElementById('send_form')); sheld.append(chat, form); document.body.append(sheld);
        document.querySelector('main').style.display = 'none'; window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => document.querySelector('#sheld > [data-lunar-area="chat"].lunar-ambient-visible'));
    assert.equal(await page.locator('[data-lunar-area="chat"] .lunar-star').count(), 16);
    assert.equal(await page.locator('#chat .lunar-ambient, #send_form .lunar-ambient').count(), 0);
    assert.equal(await page.locator('#form_sheld > [data-lunar-area="composer"]').count(), 1);
    const visibleStar = await page.locator('[data-lunar-area="chat"] .lunar-star-6').evaluate(node => {
        const animation = node.getAnimations()[0], timing = animation.effect.getTiming();
        animation.pause(); animation.currentTime = timing.delay + timing.duration * 5.55;
        const bounds = node.getBoundingClientRect(), host = document.getElementById('sheld').getBoundingClientRect();
        return { opacity: Number(getComputedStyle(node).opacity), inset: bounds.top - host.top, height: host.height,
            frameZ: Number(getComputedStyle(node.parentElement).zIndex) };
    });
    assert.ok(visibleStar.opacity > 0.2, 'Default Sheld twinkles must have a visible peak, not ~7% opacity');
    assert.ok(visibleStar.inset > 20 && visibleStar.inset < visibleStar.height - 20, 'Twinkles must also reach the interior');
    assert.ok(visibleStar.frameZ > 30, 'Frame must sit above native chat/composer stacking contexts');
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-sheld.png') });
    await page.evaluate(() => disposeUI());
    assert.equal(await page.locator('.lunar-ambient').count(), 0);
    assert.equal(await page.evaluate(() => [...document.body.classList].some(name => name.startsWith('lunar-'))), false);
    assert.deepEqual(errors, []);
    console.log('LunarUI browser checks passed: profiles, opacity, migration-safe preferences, effects, visibility, reduced motion, mobile layout and cleanup.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
