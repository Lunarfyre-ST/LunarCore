import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const igRoot = process.env.IG_SOURCE_ROOT || path.resolve(root, '../ImmersiveGroups');
const { chromium } = process.env.LUNAR_PLAYWRIGHT ? await import(pathToFileURL(process.env.LUNAR_PLAYWRIGHT).href) : await import('playwright');
const prefix = '/scripts/extensions/third-party/ImmersiveGroups/';
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body style="background:#20202b;color:#eee;font:16px sans-serif;max-width:900px;margin:30px">
<div id="extensions_settings2"></div><img id="sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='blue'/%3E%3C/svg%3E">
<script>window.handlers={};window.ctx={eventTypes:{CHAT_CHANGED:'chat',GENERATION_STARTED:'generation'},eventSource:{on(n,f){(handlers[n]||=[]).push(f)},removeListener(n,f){handlers[n]=handlers[n].filter(x=>x!==f)}}};window.SillyTavern={getContext:()=>ctx};window.ImmersiveGroups={version:'0.3.5',diagnosticsProtocol:1,getStatus:()=>({status:'ready',name:'PRIVATE'})};</script><script type="module" src="/index.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://fixture'), pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') {
            res.setHeader('content-type', 'text/html');
            const content = fixture.replace('window.ctx={', 'window.ctx={extensionSettings:{},');
            res.end(url.searchParams.has('autostart') ? content.replace('window.SillyTavern=', 'ctx.extensionSettings={LunarCore:{debug:{capacity:2000,autoStart:true}}};window.SillyTavern=') : content);
            return;
        }
        res.setHeader('content-type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
        if (pathname === '/scripts/extensions.js') { res.end(`export const extension_settings={ImmersiveGroups:{enableVN_UI:true,outfitFadeEnabled:true,outfitFadeMode:'cross',outfitFadeIn:20,outfitFadeOut:20}};export const getContext=()=>window.ctx;`); return; }
        if (pathname === prefix + 'constants.js') { res.end(`export const extensionName='ImmersiveGroups';export const defaultSettings={};`); return; }
        const base = pathname.startsWith(prefix) ? igRoot : root;
        const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
        const filename = path.resolve(base, relative);
        if (!filename.startsWith(base + path.sep) || !/\.(js|css)$/.test(filename)) { res.writeHead(404); res.end(); return; }
        res.end(await readFile(filename));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
        ctx.extensionSettings = { ImmersiveGroups: { outfitFadeIn: 200, layoutMode: 'desktop',
            sceneAutomation: { enabled: true, apiUrl: 'PRIVATE', instructionsAll: 'PRIVATE', apiTransport: 'main' } } };
        const shell = document.createElement('div'); shell.className = 'ig-settings-shell';
        shell.innerHTML = '<button id="ig-tab-animations">PRIVATE TAB TEXT</button><button data-scene-run>PRIVATE BUTTON TEXT</button><input type="range" data-animation-setting="outfitFadeIn"><input type="text" data-scene-setting="apiUrl">';
        document.body.append(shell);
        shell.querySelector('[data-scene-run]').addEventListener('click', () => {
            const op = globalThis[Symbol.for('LunarDebug.sink')].begin('automation.api', { transport: 'main' });
            setTimeout(() => op.finish({ outcome: 'completed' }), 5);
        });
        shell.querySelector('[data-animation-setting]').addEventListener('input', event => {
            ctx.extensionSettings.ImmersiveGroups.outfitFadeIn = Number(event.target.value);
            window.dispatchEvent(new Event('ig-layout-change'));
        });
    });
    const toggle = page.locator('[data-record]');
    await toggle.waitFor(); assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    await page.locator('#ig-tab-animations').click();
    await page.locator('[data-scene-run]').click();
    await page.evaluate(() => {
        const input = document.querySelector('[data-animation-setting]'); input.max = 3000;
        for (let i = 1; i <= 100; i++) { input.value = 200 + i; input.dispatchEvent(new Event('input', { bubbles: true })); }
        document.querySelector('.ig-settings-shell').dispatchEvent(new Event('scroll'));
        const privateInput = document.querySelector('[data-scene-setting="apiUrl"]');
        privateInput.value = 'PRIVATE_URL'; privateInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(async prefix => {
        const sink = globalThis[Symbol.for('LunarDebug.sink')];
        window.PRIVATE = 'PRIVATE_NAME_CREDENTIAL_CHAT_PATH';
        const background = document.createElement('div'); background.id = 'bg1'; document.body.append(background);
        await new Promise(resolve => setTimeout(resolve, 0));
        background.style.backgroundImage = 'url("/PRIVATE_BACKGROUND.png")';
        await new Promise(resolve => setTimeout(resolve, 0));
        sink.emit('outfit.change', { source: 'manual', outcome: 'applied', avatar: PRIVATE, folder: PRIVATE, error: PRIVATE });
        handlers.chat.forEach(fn => fn({ mes: PRIVATE }));
        window.animationModule = await import(prefix + 'modules/scene-animations.js');
        window.animationSettings = (await import('/scripts/extensions.js')).extension_settings.ImmersiveGroups;
        await animationModule.fadeSceneSwap(document.getElementById('sprite'), 'outfit', () => {});
        animationSettings.outfitFadeMode = 'sequential'; animationSettings.outfitFadeIn = 200; animationSettings.outfitFadeOut = 200;
        const node = document.getElementById('sprite');
        const pending = animationModule.fadeSceneSwap(node, 'outfit', () => {});
        animationModule.cancelSceneFade(node); await pending;
    }, prefix);
    const downloadPromise = page.waitForEvent('download'); await page.locator('[data-export]').click();
    const download = await downloadPromise;
    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(JSON.stringify(json).includes('PRIVATE'), false);
    assert.equal(json.schemaVersion, 3);
    assert.equal(json.versions.lunarCore, '0.0.3');
    assert.ok(json.events.some(row => row.event === 'ig.setting_snapshot' && row.setting === 'outfitFadeIn' && row.value === 200));
    assert.ok(json.events.some(row => row.event === 'ig.setting_change' && row.before === 200 && row.after === 300 && row.count === 100));
    assert.ok(json.events.some(row => row.event === 'ig.layout' && row.count === 100));
    assert.ok(json.events.some(row => row.event === 'ui.scroll' && row.area === 'settings'));
    const action = json.events.find(row => row.action === 'automation.analyze');
    assert.ok(action);
    assert.ok(json.events.some(row => row.event === 'automation.api' && row.phase === 'end' && row.causeOperation === action.operation));
    assert.ok(json.events.some(row => row.event === 'animation.swap' && row.outcome === 'completed'));
    assert.ok(json.events.some(row => row.event === 'animation.swap' && row.outcome === 'cancelled'));
    assert.ok(json.events.some(row => row.event === 'host.chat_changed'));
    assert.ok(json.events.some(row => row.event === 'background.observed'));
    await toggle.uncheck();
    assert.equal(await page.evaluate(() => handlers.chat.length), 0);
    await page.locator('[data-capacity]').fill('1000'); await page.locator('[data-capacity]').press('Tab');
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 1000);
    await page.evaluate(() => { delete ImmersiveGroups.diagnosticsProtocol; });
    await page.waitForFunction(() => document.querySelector('[data-integration]').classList.contains('lunar-debug-warning'));
    await toggle.check();
    assert.equal(await page.evaluate(() => handlers.chat.length), 1);
    await page.locator('[data-clear]').click();
    await page.locator('[data-filter]').selectOption('animation.');
    await page.evaluate(() => {
        const sink = globalThis[Symbol.for('LunarDebug.sink')];
        window.dispatchEvent(new ErrorEvent('error', { message: 'PRIVATE', filename: 'PRIVATE' }));
        window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: 'PRIVATE' }));
        for (let i = 0; i < 1020; i++) sink.emit('context.injection', { promptCharacters: i, enabled: true });
    });
    await page.waitForFunction(() => document.querySelector('[data-status]').textContent.includes('oldest events discarded') && !document.querySelector('[data-status]').textContent.includes('· 0 oldest'));
    await page.locator('[data-filter]').selectOption('context.');
    await page.waitForFunction(() => document.querySelector('[data-events]').textContent.includes('context.injection'));
    await page.locator('[data-filter]').selectOption('attention');
    await page.waitForFunction(() => document.querySelector('[data-events]').textContent.includes('runtime.error'));
    assert.equal(await page.locator('[data-events]').textContent().then(text => text.includes('PRIVATE')), false);
    assert.ok((await page.locator('[data-alert]').textContent()).includes('2 attention'));
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-debug.png') });
    await toggle.uncheck(); await page.locator('[data-clear]').click();
    assert.equal(await page.locator('[data-export]').isDisabled(), true);
    await page.reload(); assert.equal(await toggle.isChecked(), false);
    await page.locator('[data-auto-start]').check();
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.autoStart), true);
    // Simulate the host restoring preferences before extension initialization.
    await page.goto(`http://127.0.0.1:${server.address().port}/?autostart`);
    assert.equal(await toggle.isChecked(), true);
    assert.equal(await page.locator('[data-capacity]').inputValue(), '2000');
    assert.equal(await page.locator('[data-auto-start]').isChecked(), true);
    await toggle.uncheck();
    // Broken or absent consumers must not break the optional producer bridge.
    assert.equal(await page.evaluate(async prefix => {
        const helper = await import(prefix + 'modules/diagnostics.js');
        globalThis[Symbol.for('LunarDebug.sink')] = { protocol: 1, enabled: true, emit() { throw Error(PRIVATE); }, begin() { throw Error(PRIVATE); } };
        helper.diagnostic('context.injection', {}); helper.diagnosticOperation('outfit.change', {}).finish({});
        delete globalThis[Symbol.for('LunarDebug.sink')]; helper.diagnostic('context.injection', {});
        return true;
    }, prefix), true);
    assert.deepEqual(errors, []);
    console.log('Browser regressions passed: privacy, summaries, adjustable limits, retained attention history, runtime failure detection, saved preferences, auto-start, action correlation, legacy warning, listener cleanup and real IG animation hooks.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
