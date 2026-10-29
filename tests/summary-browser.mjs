import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = process.env.LUNAR_PLAYWRIGHT ? await import(pathToFileURL(process.env.LUNAR_PLAYWRIGHT).href) : await import('playwright');
const html = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="target"></div><script type="module">
import { mountSummary } from '/modules/summary/index.js';
window.callbacks = {}; window.prompts = []; window.calls = []; window.saves = 0;
window.ctx = { chatId: 'a', groupId: null, characterId: 1, chat: [{ name: 'PRIVATE_A', is_user: true, mes: 'PRIVATE_INPUT' }, { name: 'PRIVATE_B', mes: 'PRIVATE_OUTPUT', swipe_id: 0 }], chatMetadata: {}, extensionSettings: { LunarCore: { debug: { capacity: 3000 } }, connectionManager: { profiles: [{ id: 'p1', name: 'Fixture profile' }] } },
  maxContext: 1000, async getTokenCountAsync() { return 123; }, getCurrentChatId() { return this.chatId; }, saveSettingsDebounced() {}, async saveMetadata() { saves++; }, setExtensionPrompt(...args) { prompts.push(args); },
  eventTypes: { CHAT_CHANGED: 'chat', GENERATION_STARTED: 'generation', MESSAGE_RECEIVED: 'received', MESSAGE_EDITED: 'edited', MESSAGE_DELETED: 'deleted', MESSAGE_SWIPED: 'swiped', GROUP_WRAPPER_STARTED: 'groupStart', GROUP_WRAPPER_FINISHED: 'groupEnd' }, eventSource: { on(n, f) { (callbacks[n] ||= []).push(f); }, removeListener(n, f) { callbacks[n] = callbacks[n].filter(x => x !== f); } },
  generateRaw(args) { calls.push(args); return new Promise((resolve, reject) => { window.resolveRequest = resolve; window.rejectRequest = reject; }); },
  ConnectionManagerRequestService: { sendRequest(...args) { calls.push(args); return new Promise(resolve => { window.resolveRequest = resolve; }); } }
};
window.disposeSummary = mountSummary(document.getElementById('target'), () => ctx);
</script></body></html>`;
const server = http.createServer(async (req, res) => {
    try {
        const pathname = new URL(req.url, 'http://fixture').pathname;
        if (pathname === '/') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
        const file = path.resolve(root, '.' + decodeURIComponent(pathname));
        if (!file.startsWith(root + path.sep) || !/\.(js|css)$/.test(file)) { res.writeHead(404); res.end(); return; }
        res.setHeader('content-type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('.lunar-summary > summary').click();
    assert.equal(await page.locator('[data-summary-inject]').isChecked(), false);
    await page.waitForFunction(() => document.querySelector('[data-summary-meter-label]').textContent.includes('123'));
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-summary-meter]').compareDocumentPosition(document.querySelector('[data-summary-blocks]')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    assert.equal(await page.locator('[data-summary-meter]').evaluate(node => [node.value, node.max].join('/')), '123/1000');
    assert.equal(await page.evaluate(() => calls.length), 0);
    await page.locator('[data-summary-inject]').check();
    await page.locator('[data-summary-position]').selectOption('above');
    assert.equal(await page.evaluate(() => prompts.at(-1)[2]), 0);
    await page.locator('[data-summary-position]').selectOption('chat');
    await page.locator('[data-summary-depth]').fill('0'); await page.locator('[data-summary-depth]').press('Tab');
    assert.deepEqual(await page.evaluate(() => prompts.at(-1).slice(2, 4)), [1, 0]);
    await page.locator('[data-summary-ghost]').check();
    await page.locator('[data-summary-generate]').click();
    assert.equal(await page.evaluate(() => calls.length), 1);
    await page.evaluate(() => resolveRequest('First block'));
    await page.waitForFunction(() => document.querySelector('[data-summary-draft]').value === 'First block');
    assert.equal(await page.evaluate(() => saves), 0);
    await page.evaluate(() => { ctx.saveMetadata = async () => { throw new Error('PRIVATE_ERROR'); }; });
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('Could not save'));
    assert.deepEqual(await page.evaluate(() => ctx.chat.map(m => Boolean(m.is_system))), [false, false]);
    assert.equal(await page.evaluate(() => ctx.chatMetadata.LunarCore_summary), undefined);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.evaluate(() => { ctx.saveMetadata = async () => { saves++; }; });
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => document.querySelectorAll('.lunar-summary-block').length === 1);
    assert.ok((await page.locator('.lunar-summary-block').first().textContent()).includes('Messages 1–2'));
    assert.deepEqual(await page.evaluate(() => ctx.chat.map(m => m.is_system)), [true, true]);
    assert.ok((await page.evaluate(() => prompts.at(-1)[1])).includes('First block'));
    await page.locator('.lunar-summary-block').first().getByRole('button', { name: /Edit/ }).click();
    await page.locator('[data-summary-draft]').fill('First block revised');
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => document.querySelector('.lunar-summary-block').textContent.includes('First block revised'));
    assert.ok((await page.evaluate(() => prompts.at(-1)[1])).includes('First block revised'));
    await page.waitForFunction(() => document.querySelector('[data-summary-stats]').textContent.includes('2 summarized messages'));
    assert.ok((await page.locator('[data-summary-stats]').textContent()).includes('2 by LunarSummary'));
    await page.evaluate(() => { ctx.chat.push({name:'PRIVATE_C',mes:'Third'}, {name:'PRIVATE_D',mes:'Fourth'}); });
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => resolveRequest('Second block'));
    await page.waitForFunction(() => document.querySelector('[data-summary-draft]').value === 'Second block');
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => document.querySelectorAll('.lunar-summary-block').length === 2);
    assert.ok((await page.locator('.lunar-summary-block').nth(1).textContent()).includes('Messages 3–4'));
    await mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
    await page.setViewportSize({ width: 390, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(root, 'tests/artifacts/lunar-summary-blocks.png'), fullPage: true });
    assert.equal(await page.evaluate(() => ctx.chatMetadata.LunarCore_summary.segments.length), 2);
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 3000);
    await page.evaluate(() => {
        window.oldChat = ctx.chat; window.oldMetadata = ctx.chatMetadata;
        ctx.chatId = 'other'; ctx.chat = [{mes:'different'}]; ctx.chatMetadata = {}; callbacks.chat.forEach(fn => fn());
        ctx.chatId = 'a'; ctx.chat = oldChat; ctx.chatMetadata = oldMetadata; callbacks.chat.forEach(fn => fn());
    });
    assert.equal(await page.locator('.lunar-summary-block').count(), 2);
    assert.ok((await page.evaluate(() => prompts.at(-1)[1])).includes('First block'));
    await page.evaluate(() => { ctx.chat.push({is_system:true,mes:'A pre-existing hidden message'}); });
    await page.evaluate(() => { ctx.chat[0].mes = 'Edited'; callbacks.edited.forEach(fn => fn(0)); });
    await page.waitForFunction(() => document.querySelector('.lunar-summary-block').textContent.includes('needs review'));
    assert.deepEqual(await page.evaluate(() => ctx.chat.map(m => m.is_system)), [false, false, true, true, true]);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1].includes('First block')), false);
    await page.locator('[data-summary-unhide]').click();
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('Unhid 2'));
    assert.deepEqual(await page.evaluate(() => ctx.chat.map(m => m.is_system)), [false, false, false, false, true]);
    assert.equal(await page.locator('.lunar-summary-block').count(), 2);
    await page.locator('.lunar-summary-block').first().getByRole('button', { name: /Delete/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.lunar-summary-block').length === 1);
    assert.equal(await page.evaluate(() => ctx.chat[0].extra.lunarSummaryBlock), undefined);
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => resolveRequest('Draft awaiting review'));
    await page.waitForFunction(() => document.querySelector('[data-summary-draft]').value === 'Draft awaiting review');
    await page.evaluate(() => { ctx.chatId = 'b'; ctx.chatMetadata = {}; ctx.chat = [{name:'Other',mes:'Other chat'}]; callbacks.chat.forEach(fn => fn()); });
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), '');
    assert.equal(await page.locator('.lunar-summary-block').count(), 0);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.locator('[data-summary-transport]').selectOption('profile');
    await page.locator('[data-summary-profile]').selectOption('p1');
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => { callbacks.generation.forEach(fn => fn('normal', {}, false)); resolveRequest({content:'Overlapped'}); });
    await page.waitForFunction(() => !document.querySelector('[data-summary-generate]').disabled);
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), '');
    // Forced work runs several bounded batches and stops at the chosen message.
    await page.evaluate(() => { ctx.chat.push({mes:'two'}, {mes:'three'}, {mes:'four'}, {mes:'five'}, {mes:'six'}); window.beforeForce = calls.length; });
    await page.locator('[data-summary-messages]').fill('2'); await page.locator('[data-summary-messages]').press('Tab');
    await page.locator('[data-summary-through]').fill('5'); await page.locator('[data-summary-force]').click();
    for (let i = 1; i <= 3; i++) {
        await page.waitForFunction(n => calls.length === beforeForce + n, i);
        await page.evaluate(n => resolveRequest({ content: `Forced block ${n}` }), i);
        await page.waitForFunction(n => document.querySelectorAll('.lunar-summary-block').length === n, i);
    }
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('complete'));
    assert.equal(await page.evaluate(() => Boolean(ctx.chat[5].extra?.lunarSummaryBlock)), false);
    // Automatic work waits for a full block and the group wrapper to finish.
    await page.locator('[data-summary-auto]').check();
    await page.evaluate(() => { ctx.chat.push({mes:'seven'}); window.beforeAuto = calls.length; callbacks.groupStart.forEach(fn => fn()); callbacks.received.forEach(fn => fn(6)); });
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => calls.length), await page.evaluate(() => beforeAuto));
    await page.evaluate(() => callbacks.groupEnd.forEach(fn => fn()));
    await page.waitForFunction(() => calls.length === beforeAuto + 1);
    await page.evaluate(() => resolveRequest({ content: 'Automatic block' }));
    await page.waitForFunction(() => document.querySelectorAll('.lunar-summary-block').length === 4);
    await page.evaluate(() => { ctx.chat.splice(1, 1); callbacks.deleted.forEach(fn => fn(1)); });
    await page.waitForFunction(() => document.querySelectorAll('.lunar-summary-block')[0].textContent.includes('needs review'));
    assert.equal((await page.locator('.lunar-summary-block').nth(1).textContent()).includes('needs review'), false, 'Deleting the last message of one block must not invalidate the following block');
    await page.evaluate(() => {
        const chatNode = document.createElement('div'); chatNode.id = 'chat';
        chatNode.innerHTML = '<div class="mes" mesid="1"><button class="mes_unhide">Native unhide</button></div>';
        document.body.append(chatNode);
        chatNode.querySelector('button').addEventListener('click', () => { ctx.chat[1].is_system = false; });
    });
    await page.locator('#chat .mes_unhide').click();
    assert.equal(await page.evaluate(() => ctx.chat[1].extra.lunarSummaryGhost), undefined);
    await page.evaluate(() => { ctx.chat[1].is_system = true; }); // User hides it again using the host.
    await page.locator('[data-summary-unhide]').click();
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('Unhid'));
    assert.equal(await page.evaluate(() => ctx.chat[1].is_system), true, 'A subsequent user-owned hide must survive LunarSummary restoration');
    // Catch-up fills gaps in full blocks, using the chat boundary from the click.
    await page.locator('[data-summary-auto]').uncheck();
    await page.evaluate(() => {
        ctx.chatId = 'catchup';
        ctx.chat = [{mes:'one'}, {mes:'two'}, {mes:'covered',extra:{lunarSummaryBlock:'existing'}}, {mes:'three'}, {mes:'four'}, {mes:'partial'}];
        ctx.chatMetadata = {LunarCore_summary:{segments:[{id:'existing',text:'Existing',start:3,end:3,count:1,stale:false}],text:'Existing'}};
        callbacks.chat.forEach(fn => fn());
        window.beforeCatchUp = calls.length;
        let firstSave = true;
        ctx.saveMetadata = async () => { saves++; if (firstSave) { firstSave = false; ctx.chat.push({mes:'later one'}, {mes:'later two'}); } };
    });
    await page.locator('[data-summary-catch-up]').click();
    for (let i = 1; i <= 2; i++) {
        await page.waitForFunction(n => calls.length === beforeCatchUp + n, i);
        await page.evaluate(n => resolveRequest({content:`Catch-up block ${n}`}), i);
        await page.waitForFunction(n => document.querySelectorAll('.lunar-summary-block').length === n + 1, i);
    }
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('partial block'));
    assert.equal(await page.evaluate(() => calls.length), await page.evaluate(() => beforeCatchUp + 2));
    assert.deepEqual(await page.evaluate(() => ctx.chat.map(m => Boolean(m.extra?.lunarSummaryBlock))), [true, true, true, true, true, false, false, false]);
    await page.evaluate(() => { ctx.saveMetadata = async () => { saves++; }; });
    await page.evaluate(() => { ctx.chat[2].extra.lunarSummaryGhost = true; ctx.chat[2].is_system = true; });
    await page.evaluate(() => disposeSummary());
    assert.equal(await page.evaluate(() => callbacks.chat.length), 0);
    assert.equal(await page.evaluate(() => callbacks.generation.length), 0);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.evaluate(async () => {
        ctx.setExtensionPrompt = () => { throw new Error('Unavailable'); };
        const { mountSummary } = await import('/modules/summary/index.js');
        window.disposeAgain = mountSummary(document.getElementById('target'), () => ctx);
    });
    assert.equal(await page.evaluate(() => ctx.chat.some(message => message.extra?.lunarSummaryGhost)), false);
    assert.ok((await page.locator('[data-summary-status]').textContent()).includes('messages were restored'));
    await page.evaluate(() => disposeAgain());
    assert.deepEqual(errors, []);
    console.log('LunarSummary browser checks passed: manual requests, review/save, injection, stale replies, cancellation and chat isolation.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
