import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import debugFeatures from './browser-debug-features.mjs';

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
            res.end(url.searchParams.has('autostart') ? content.replace('window.SillyTavern=', 'ctx.extensionSettings={LunarCore:{debug:{capacity:2000,autoStart:true},ui:{moonlightBlue:true}}};window.SillyTavern=') : content);
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
    if (process.env.LUNAR_DEBUG_ONLY === '1') {
        await debugFeatures(browser, `http://127.0.0.1:${server.address().port}`, prefix);
    } else {
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const openDebug = async () => {
        await page.locator('.lunar-core > summary').click();
        await page.locator('.lunar-debug > summary').click();
    };
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
        ctx.extensionSettings.ImmersiveGroups = { outfitFadeIn: 200, layoutMode: 'desktop',
            sceneAutomation: { enabled: true, apiUrl: 'PRIVATE', instructionsAll: 'PRIVATE', apiTransport: 'main' } };
        Object.assign(ctx.eventTypes, { GENERATION_ENDED: 'generationEnd', GENERATION_STOPPED: 'generationStop', GENERATION_AFTER_COMMANDS: 'generationAfter' });
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
    await page.evaluate(() => {
        const column = document.createElement('div'); column.id = 'extensions_settings';
        document.body.prepend(column);
        const ig = document.createElement('div'); ig.className = 'prome-vn-settings';
        ig.textContent = 'ImmersiveGroups'; column.append(ig);
        document.dispatchEvent(new Event('immersivegroups:ready'));
    });
    assert.equal(await page.evaluate(() => document.querySelector('.prome-vn-settings').previousElementSibling === document.querySelector('.lunar-core')), true);
    assert.equal(await page.locator('.lunar-core').evaluate(node => node.open), false);
    await page.locator('.lunar-core > summary').click();
    assert.equal(await page.locator('.lunar-version').textContent(), 'LunarCore 0.0.7');
    assert.equal(await page.locator('.lunar-core > .lunar-drawer-content > details').count(), 2);
    await page.locator('.lunar-ui > summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.lunar-ui').evaluate(node => node.open), true);
    assert.equal(await page.locator('.lunar-debug').evaluate(node => node.open), false);
    const moonlight = page.locator('[data-moonlight]');
    assert.equal(await moonlight.isChecked(), false);
    await page.evaluate(() => document.documentElement.style.setProperty('--SmartThemeQuoteColor', '#e0aa44'));
    await moonlight.check();
    assert.equal(await page.evaluate(() => document.body.classList.contains('lunar-moonlight')), true);
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.ui.moonlightBlue), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--SmartThemeQuoteColor').trim()), '#a2b5cd');
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--SmartThemeQuoteColor')), '#e0aa44');
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-moonlight.png') });
    await moonlight.uncheck();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--SmartThemeQuoteColor').trim()), '#e0aa44');
    await page.locator('.lunar-ui > summary').click();
    await page.locator('.lunar-debug > summary').click();
    await toggle.waitFor(); assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    await page.locator('.lunar-ui > summary').click();
    await moonlight.check(); await moonlight.uncheck();
    await page.locator('.lunar-ui > summary').click();
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
        animationModule.cancelSceneFade(node, 'user_cancelled'); await pending;
        Object.assign(animationSettings, { backgroundFadeEnabled: true, backgroundFadeMode: 'cross', backgroundFadeIn: 20, backgroundFadeOut: 20 });
        animationModule.setupSceneAnimations();
        const layoutPending = animationModule.fadeSceneSwap(node, 'outfit', () => {});
        window.dispatchEvent(new Event('ig-layout-change')); await layoutPending;
        const superseded = animationModule.fadeSceneSwap(node, 'outfit', () => {});
        const newest = animationModule.fadeSceneSwap(node, 'outfit', () => {});
        await Promise.all([superseded, newest]);
        const chatPending = animationModule.fadeSceneSwap(node, 'outfit', () => {});
        handlers.chat.forEach(fn => fn({ name: PRIVATE, mes: PRIVATE })); await chatPending;
        const helper = await import(prefix + 'modules/diagnostics.js');
        const picker = document.createElement('div'); picker.className = 'ig-background-popover';
        picker.innerHTML = '<div data-bg-results><button class="ig-media-card" data-asset-id="PRIVATE">PRIVATE ASSET NAME</button></div>';
        document.body.append(picker);
        picker.querySelector('button').addEventListener('click', () => {
            const trace = helper.diagnosticOperation('background.select', { source: 'manual' });
            background.style.backgroundImage = 'url("/backgrounds/PRIVATE_SELECTED.png")';
            animationModule.bindBackgroundDiagnostic(background, trace);
            trace.finish({ outcome: 'requested' });
        });
        handlers.generation.forEach(fn => fn('quiet', { quiet_prompt: PRIVATE, automatic_trigger: true }, true));
        handlers.generation.forEach(fn => fn('normal', { quiet_prompt: PRIVATE }, false));
        handlers.generationAfter.forEach(fn => fn('normal', { quiet_prompt: PRIVATE }, false));
        handlers.generationEnd.forEach(fn => fn({ mes: PRIVATE }));
        handlers.generation.forEach(fn => fn('impersonate', {}, false));
        handlers.generationStop.forEach(fn => fn(PRIVATE));
    }, prefix);
    await page.locator('.ig-background-popover .ig-media-card').click();
    await page.waitForFunction(() => !document.querySelector('.ig-background-transition') && document.getElementById('bg1').getAnimations().length === 0);
    const downloadPromise = page.waitForEvent('download'); await page.locator('[data-export]').click();
    const download = await downloadPromise;
    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(JSON.stringify(json).includes('PRIVATE'), false);
    assert.equal(json.schemaVersion, 4);
    assert.equal(json.versions.lunarCore, '0.0.7');
    assert.ok(json.events.some(row => row.event === 'ui.theme' && row.theme === 'moonlight_blue' && row.enabled === true));
    assert.ok(json.events.some(row => row.event === 'ig.setting_snapshot' && row.setting === 'outfitFadeIn' && row.value === 200));
    assert.ok(json.events.some(row => row.event === 'ig.setting_change' && row.before === 200 && row.after === 300 && row.count === 100));
    assert.ok(json.events.some(row => row.event === 'ig.layout' && row.count >= 100));
    assert.ok(json.events.some(row => row.event === 'ui.scroll' && row.area === 'settings'));
    const action = json.events.find(row => row.action === 'automation.analyze');
    assert.ok(action);
    assert.ok(json.events.some(row => row.event === 'automation.api' && row.phase === 'end' && row.causeOperation === action.operation));
    assert.ok(json.events.some(row => row.event === 'animation.swap' && row.outcome === 'completed'));
    assert.ok(json.events.some(row => row.event === 'animation.swap' && row.outcome === 'cancelled'));
    assert.ok(json.events.some(row => row.event === 'host.chat_changed'));
    assert.ok(json.events.some(row => row.event === 'background.observed'));
    for (const reason of ['user_cancelled', 'layout_changed', 'superseded', 'chat_changed']) assert.ok(json.events.some(row => row.event === 'animation.swap' && row.outcome === 'cancelled' && row.reason === reason), reason);
    const backgroundAction = json.events.find(row => row.action === 'background.select');
    const backgroundStart = json.events.find(row => row.event === 'background.select' && row.phase === 'start');
    assert.ok(backgroundAction); assert.equal(backgroundStart.causeOperation, backgroundAction.operation);
    assert.ok(json.events.some(row => row.event === 'animation.background' && row.causeOperation === backgroundStart.operation));
    assert.ok(json.events.some(row => row.event === 'generation.lifecycle' && row.reason === 'dry_run'));
    assert.ok(json.events.some(row => row.event === 'generation.lifecycle' && row.reason === 'end_event'));
    assert.ok(json.events.some(row => row.event === 'generation.lifecycle' && row.reason === 'stop_event'));
    await toggle.uncheck();
    assert.equal(await page.evaluate(() => handlers.chat.length), 1); // IG animation cancellation remains subscribed.
    await page.locator('[data-capacity]').fill('1000'); await page.locator('[data-capacity]').press('Tab');
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 1000);
    await page.evaluate(() => { delete ImmersiveGroups.diagnosticsProtocol; });
    await page.waitForFunction(() => document.querySelector('[data-integration]').classList.contains('lunar-debug-warning'));
    await toggle.check();
    assert.equal(await page.evaluate(() => handlers.chat.length), 3); // Host, lifecycle and IG animation subscribers.
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
    await page.locator('.lunar-core > summary').click();
    assert.equal(await page.locator('.lunar-core').evaluate(node => node.open), false);
    assert.ok((await page.locator('.lunar-core > summary .lunar-attention').textContent()).includes('2 attention'));
    assert.equal(await toggle.isChecked(), true);
    await page.locator('.lunar-core > summary').click();
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-debug.png') });
    await toggle.uncheck(); await page.locator('[data-clear]').click();
    assert.equal(await page.locator('[data-export]').isDisabled(), true);
    await page.reload(); await openDebug(); assert.equal(await toggle.isChecked(), false);
    await page.locator('[data-auto-start]').check();
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.autoStart), true);
    // Simulate the host restoring preferences before extension initialization.
    await page.goto(`http://127.0.0.1:${server.address().port}/?autostart`);
    await openDebug();
    assert.equal(await toggle.isChecked(), true);
    assert.equal(await page.locator('[data-capacity]').inputValue(), '2000');
    assert.equal(await page.locator('[data-auto-start]').isChecked(), true);
    assert.equal(await page.evaluate(() => document.body.classList.contains('lunar-moonlight')), true);
    await toggle.uncheck();
    // Broken or absent consumers must not break the optional producer bridge.
    assert.equal(await page.evaluate(async prefix => {
        const helper = await import(prefix + 'modules/diagnostics.js');
        globalThis[Symbol.for('LunarDebug.sink')] = { protocol: 1, enabled: true, emit() { throw Error(PRIVATE); }, begin() { throw Error(PRIVATE); } };
        helper.diagnostic('context.injection', {}); helper.diagnosticOperation('outfit.change', {}).finish({});
        let calls = 0;
        for (const run of [() => {}, () => { throw Error('consumer'); }, callback => { callback(); callback(); throw Error('consumer'); }]) {
            globalThis[Symbol.for('LunarDebug.sink')] = { protocol: 1, enabled: true, begin: () => ({ run }) };
            const result = helper.diagnosticOperation('outfit.change', {}).run(() => { calls++; return 42; });
            if (result !== 42) return false;
        }
        if (calls !== 3) return false;
        globalThis[Symbol.for('LunarDebug.sink')] = { protocol: 2, enabled: true, begin() { throw Error('incompatible consumer called'); } };
        if (helper.diagnosticOperation('outfit.change', {}).run(() => 7) !== 7) return false;
        delete globalThis[Symbol.for('LunarDebug.sink')]; helper.diagnostic('context.injection', {});
        return true;
    }, prefix), true);
    await page.evaluate(() => globalThis[Symbol.for('LunarCore.runtime')].dispose());
    assert.equal(await page.evaluate(() => document.body.classList.contains('lunar-moonlight')), false);
    assert.equal(await page.locator('.lunar-core').count(), 0);
    assert.deepEqual(errors, []);
    await debugFeatures(browser, `http://127.0.0.1:${server.address().port}`, prefix);
    console.log('Browser regressions passed: privacy, summaries, adjustable limits, retained attention history, runtime failure detection, saved preferences, auto-start, action correlation, legacy warning, listener cleanup and real IG animation hooks.');
}
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
