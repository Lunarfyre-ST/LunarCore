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
    await page.locator('[data-text-body]').evaluate(node => { node.value = '#b0b8c0'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-ui-profile]').selectOption('starlight');
    assert.equal(await page.locator('[data-ui-opacity]').inputValue(), '72');
    assert.equal(await page.locator('[data-text-body]').inputValue(), '#a9afbd');
    await page.locator('[data-text-enabled]').uncheck();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--SmartThemeBodyColor').trim()), '#d8d9e2');
    await page.locator('[data-text-enabled]').check();
    await page.locator('[data-ui-profile]').selectOption('twilight');
    assert.equal(await page.locator('[data-text-body]').inputValue(), '#b0b8c0');
    await page.locator('[data-ui-effects]').check();
    assert.equal(await page.locator('[data-area-breathing]').isDisabled(), true);
    await page.locator('[data-ui-breathing]').check();
    assert.equal(await page.locator('[data-area-breathing]').isDisabled(), false);
    await page.waitForFunction(() => document.querySelectorAll('.lunar-ambient-visible').length > 0);
    const baseCount = await page.locator('.lunar-ambient').count();
    assert.equal(baseCount, 7);
    assert.equal(await page.locator('#chat > .lunar-ambient').count(), 1);
    assert.equal(await page.locator('.lunar-ambient').first().evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    await page.locator('[data-ui-intensity]').evaluate(node => { node.value = 65; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-ui-speed]').evaluate(node => { node.value = 0.5; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--lunar-twinkle-time')), '20s');
    const starDuration = await page.locator('.lunar-star').first().evaluate(node => getComputedStyle(node).animationDuration);
    assert.equal(starDuration, '20s');
    const star = page.locator('[data-lunar-area="chat"] .lunar-star-6');
    const originalPosition = await star.evaluate(node => [node.style.left, node.style.top]);
    await page.locator('[data-ui-random]').check();
    const randomPosition = await star.evaluate(node => [node.style.left, node.style.top]);
    assert.notDeepEqual(randomPosition, originalPosition);
    const unchangedDuration = await star.evaluate(node => getComputedStyle(node).animationDuration);
    await star.evaluate(node => node.dispatchEvent(new AnimationEvent('animationiteration', { animationName: 'lunar-twinkle', bubbles: true })));
    assert.notDeepEqual(await star.evaluate(node => [node.style.left, node.style.top]), randomPosition);
    assert.equal(await star.evaluate(node => getComputedStyle(node).animationDuration), unchangedDuration);
    await page.locator('[data-ui-random]').uncheck();
    assert.deepEqual(await star.evaluate(node => [node.style.left, node.style.top]), originalPosition);
    assert.equal(await star.evaluate(node => getComputedStyle(node).mixBlendMode), 'screen');
    await page.locator('[data-ui-profile]').selectOption('starlight');
    assert.ok(Number.parseFloat(await star.evaluate(node => getComputedStyle(node).animationDuration)) > Number.parseFloat(unchangedDuration));
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-starlight.png'), fullPage: true });
    await page.locator('[data-ui-profile]').selectOption('twilight');
    await page.locator('[data-ui-twinkles]').uncheck();
    assert.equal(await page.locator('.lunar-star').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.locator('[data-ui-twinkles]').check();
    // Local controls affect only the selected area, survive reload, and never enter chat/form DOM.
    await page.locator('[data-ui-area]').selectOption('chat');
    assert.equal(await page.locator('[data-area-twinkles]').inputValue(), '25');
    const bloom = page.locator('[data-lunar-area="chat"] .lunar-halo');
    assert.notEqual(await bloom.evaluate(node => getComputedStyle(node).boxShadow), 'none');
    assert.equal(await bloom.evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
    await page.locator('[data-area-breathing]').evaluate(node => { node.value = 0; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await bloom.evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.locator('[data-area-breathing]').evaluate(node => { node.value = 80; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await bloom.evaluate(node => getComputedStyle(node).animationName), 'lunar-breathe');
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
    assert.equal(await page.locator('[data-text-body]').inputValue(), '#b0b8c0');
    await page.locator('[data-ui-area]').selectOption('chat');
    assert.equal(await page.locator('[data-area-twinkles]').inputValue(), '0');
    assert.equal(await page.locator('[data-area-speed]').inputValue(), '2');
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 5000);
    // Native drawers are static flex items: the entire toolbar anchors their popup.
    // Making an individual drawer relative shifts its popup under that icon.
    await page.locator('[data-ui-effects]').uncheck();
    const nativeDrawer = await page.evaluate(() => {
        const nav = document.getElementById('top-settings-holder');
        window.originalNavStyle = nav.getAttribute('style');
        nav.style.cssText = 'position:fixed;display:flex;left:20px;top:20px;width:360px;height:40px;z-index:3005';
        for (let i = 0; i < 3; i++) {
            const drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.dataset.nativeFixture = '';
            drawer.style.cssText = 'display:flex;flex:1';
            const icon = document.createElement('span'); icon.className = 'drawer-icon'; icon.textContent = 'Icon'; drawer.append(icon);
            if (i === 2) {
                const popup = document.createElement('div'); popup.id = 'native-toolbar-popup'; popup.className = 'drawer-content';
                popup.style.cssText = 'position:absolute;left:0;top:40px;width:100%;height:100px'; popup.textContent = 'Fixture dropdown'; drawer.append(popup);
            }
            nav.append(drawer);
        }
        const rect = document.getElementById('native-toolbar-popup').getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width };
    });
    await page.locator('[data-ui-effects]').check();
    await page.waitForFunction(() => document.querySelector('#native-toolbar-popup > .lunar-ambient'));
    const themedDrawer = await page.locator('#native-toolbar-popup').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, anchor: node.offsetParent.id, parentPosition: getComputedStyle(node.parentElement).position };
    });
    assert.deepEqual({ left: themedDrawer.left, top: themedDrawer.top, width: themedDrawer.width }, nativeDrawer);
    assert.equal(themedDrawer.anchor, 'top-settings-holder');
    assert.equal(themedDrawer.parentPosition, 'static');
    await page.evaluate(() => {
        document.querySelectorAll('[data-native-fixture]').forEach(node => node.remove());
        const nav = document.getElementById('top-settings-holder');
        if (window.originalNavStyle === null) nav.removeAttribute('style'); else nav.setAttribute('style', window.originalNavStyle);
    });
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
    await page.locator('[data-ui-effects]').uncheck();
    await page.evaluate(() => {
        const sheld = document.createElement('div'); sheld.id = 'sheld';
        sheld.style.cssText = 'position:fixed;left:30px;top:50px;width:300px;height:600px;display:flex;flex-direction:column;overflow:hidden;transform:translateZ(0);background:#101522;z-index:30';
        const chat = document.getElementById('chat'); chat.style.cssText = 'flex:1;overflow:auto;z-index:30;backdrop-filter:blur(10px);background:#101522';
        const nativeOffsets = document.createElement('style'); nativeOffsets.textContent = '#chat { bottom:10px; border-top:1px solid #555; } #form_sheld { margin:1px auto 0; } body.waifuMode #chat { border-radius:20px 20px 0 0; } #send_form { border:1px solid #555; background-color:#343434; } #send_form:has(#send_textarea:focus-visible) { outline:1px solid white; border-color:white; }'; document.head.append(nativeOffsets);
        const form = document.createElement('div'); form.id = 'form_sheld'; form.style.cssText = 'position:relative;z-index:30';
        const controls = document.createElement('div'); controls.id = 'fixture-ig-controls'; controls.style.cssText = 'height:80px;flex-shrink:0';
        const message = document.createElement('div'); message.className = 'mes'; message.style.cssText = 'position:relative;bottom:3px;min-height:100px;background:#293749';
        const text = document.createElement('div'); text.className = 'mes_text'; text.textContent = 'Fixture message text remains above the stars.';
        message.append(text); chat.append(message);
        form.append(document.getElementById('send_form')); sheld.append(controls, chat, form); document.body.append(sheld);
        window.scrollTo(0, 0);
    });
    const measureSheld = () => page.evaluate(() => {
        const chat = document.getElementById('chat'), form = document.getElementById('form_sheld');
        const rect = chat.getBoundingClientRect(), composer = form.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, gap: composer.top - rect.bottom,
            viewportGap: innerHeight - composer.bottom, border: getComputedStyle(chat).borderTopWidth };
    });
    const nativeSheld = await measureSheld();
    assert.equal(nativeSheld.gap, 1);
    await page.locator('[data-ui-effects]').check();
    await page.evaluate(() => { document.querySelector('main').style.display = 'none'; });
    await page.waitForFunction(() => document.querySelector('#chat > [data-lunar-area="chat"].lunar-ambient-visible'));
    assert.deepEqual(await measureSheld(), nativeSheld, 'Effects must not activate the native bottom:10px offset or alter composer spacing');
    assert.equal(await page.locator('#chat').evaluate(node => getComputedStyle(node).bottom), '0px');
    assert.equal(await page.locator('#chat .mes').evaluate(node => getComputedStyle(node).bottom), '3px', 'Existing positioned offsets must remain intact');
    assert.equal(await page.locator('[data-lunar-area="chat"] .lunar-star').count(), 16);
    assert.equal(await page.locator('#send_form .lunar-ambient').count(), 0);
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
    assert.equal(visibleStar.frameZ, 0, 'Decorations belong below text content');
    assert.equal(await page.locator('#draft').evaluate(node => getComputedStyle(node).zIndex), '1');
    assert.equal(await page.locator('#chat .mes').evaluate(node => getComputedStyle(node).zIndex), 'auto');
    assert.equal(await page.locator('#chat .mes_text').evaluate(node => getComputedStyle(node).zIndex), '1');
    assert.equal(await page.locator('#chat .lunar-star').first().evaluate(node => getComputedStyle(node).mixBlendMode), 'screen');
    async function assertChatSweep() {
        await page.waitForFunction(() => {
            const frame = document.querySelector('[data-lunar-area="chat"]'), chat = document.getElementById('chat');
            const bounds = frame.getBoundingClientRect(), target = chat.getBoundingClientRect();
            return Math.abs(bounds.top - (target.top + chat.clientTop)) < 1 && Math.abs(bounds.height - chat.clientHeight) < 1;
        });
        const sweep = await page.locator('[data-lunar-area="chat"] .lunar-sheen').evaluate(node => ({
            mask: getComputedStyle(node).maskImage, height: node.getBoundingClientRect().height,
            top: node.getBoundingClientRect().top, controlsBottom: document.getElementById('fixture-ig-controls').getBoundingClientRect().bottom,
            composerTop: document.getElementById('form_sheld').getBoundingClientRect().top,
            bottom: node.getBoundingClientRect().bottom,
        }));
        assert.equal(sweep.mask, 'none', 'Chat sweeps must cross the viewport, not a thin edge strip');
        assert.ok(sweep.height > 100);
        assert.ok(sweep.top >= sweep.controlsBottom && sweep.bottom <= sweep.composerTop + 1);
    }
    await assertChatSweep();
    assert.equal((await measureSheld()).gap, 1, 'Resized IG controls must not reintroduce the gap');
    assert.equal(await page.locator('#form_sheld').evaluate(node => getComputedStyle(node).position), 'relative');
    await page.evaluate(() => document.getElementById('fixture-ig-controls').style.height = '130px');
    await assertChatSweep();
    // Welcome → VN/chat and a replacement composer must be themed immediately,
    // independently of effect lifecycle or further user interaction.
    await page.evaluate(() => {
        document.body.classList.add('waifuMode');
        const toggle = document.querySelector('[data-moonlight]'); toggle.checked = true; toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal((await measureSheld()).gap, 0);
    assert.equal((await measureSheld()).border, '0px');
    assert.equal(await page.locator('#chat').evaluate(node => getComputedStyle(node).borderTopLeftRadius), '20px');
    assert.equal(await page.locator('#chat').evaluate(node => getComputedStyle(node).borderTopRightRadius), '20px');
    const composerTint = await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(composerTint, 'rgba(10, 8, 21, 0.46)');
    await page.evaluate(() => {
        const toggle = document.querySelector('[data-ui-effects]'); toggle.checked = false; toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal(await page.locator('.lunar-ambient').count(), 0);
    assert.equal(await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor), composerTint, 'Composer recolor must not depend on animations');
    await page.evaluate(() => {
        const previous = document.getElementById('send_form'), next = document.createElement('div');
        next.id = 'send_form'; next.append(...previous.childNodes);
        next.style.backgroundColor = '#777777'; previous.replaceWith(next);
    });
    assert.equal(await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor), composerTint);
    await page.locator('#send_textarea').focus();
    assert.equal(await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor), composerTint);
    assert.notEqual(await page.locator('#send_form').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
    await page.locator('#send_textarea').blur();
    assert.equal(await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor), composerTint);
    await page.evaluate(() => {
        const toggle = document.querySelector('[data-moonlight]'); toggle.checked = false; toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal((await measureSheld()).gap, 1);
    assert.equal((await measureSheld()).border, '1px');
    assert.equal(await page.locator('#chat').evaluate(node => getComputedStyle(node).borderTopLeftRadius), '20px');
    assert.equal(await page.locator('#send_form').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(119, 119, 119)');
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-sheld.png') });
    const beforeCleanup = await measureSheld();
    await page.evaluate(() => disposeUI());
    assert.deepEqual(await measureSheld(), beforeCleanup);
    assert.equal(await page.locator('#chat').evaluate(node => getComputedStyle(node).bottom), '10px', 'Cleanup restores the native inactive inset');
    assert.equal(await page.locator('.lunar-ambient').count(), 0);
    assert.equal(await page.locator('.lunar-content-layer, .lunar-layer-surface, .lunar-content-position, .lunar-message-base').count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--lunar-text-body')), '');
    assert.equal(await page.evaluate(() => [...document.body.classList].some(name => name.startsWith('lunar-'))), false);
    assert.deepEqual(errors, []);
    console.log('LunarUI browser checks passed: profiles, opacity, migration-safe preferences, effects, visibility, reduced motion, mobile layout and cleanup.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
