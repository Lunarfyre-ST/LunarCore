import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = process.env.LUNAR_PLAYWRIGHT ? await import(pathToFileURL(process.env.LUNAR_PLAYWRIGHT).href) : await import('playwright');
const html = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="target"></div><script type="module">
import { mountSummary } from '/modules/summary/index.js';
window.callbacks = {}; window.prompts = []; window.calls = []; window.saves = 0;
window.ctx = { chatId: 'a', groupId: null, characterId: 1, chat: [{ name: 'PRIVATE_A', is_user: true, mes: 'PRIVATE_INPUT' }, { name: 'PRIVATE_B', mes: 'PRIVATE_OUTPUT', swipe_id: 0 }], chatMetadata: {}, extensionSettings: { LunarCore: { debug: { capacity: 3000 } }, connectionManager: { profiles: [{ id: 'p1', name: 'Fixture profile' }] } },
  maxContext: 1000, async getTokenCountAsync() { return 123; }, getCurrentChatId() { return this.chatId; }, saveSettingsDebounced() {}, async saveMetadata() { saves++; }, setExtensionPrompt(...args) { prompts.push(args); },
  eventTypes: { CHAT_CHANGED: 'chat', GENERATION_STARTED: 'generation' }, eventSource: { on(n, f) { (callbacks[n] ||= []).push(f); }, removeListener(n, f) { callbacks[n] = callbacks[n].filter(x => x !== f); } },
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
    assert.equal(await page.locator('[data-summary-meter]').evaluate(node => [node.value, node.max].join('/')), '123/1000');
    assert.equal(await page.evaluate(() => calls.length), 0);
    await page.locator('[data-summary-generate]').click();
    assert.equal(await page.evaluate(() => calls.length), 1);
    assert.equal(await page.locator('[data-summary-generate]').isDisabled(), true);
    await page.evaluate(() => resolveRequest('First draft'));
    await page.waitForFunction(() => document.querySelector('[data-summary-draft]').value === 'First draft');
    assert.equal(await page.evaluate(() => saves), 0);
    await page.locator('[data-summary-draft]').fill('Reviewed summary');
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => saves === 1);
    assert.equal(await page.evaluate(() => ctx.chatMetadata.LunarCore_summary.text), 'Reviewed summary');
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.locator('[data-summary-inject]').check();
    assert.ok((await page.evaluate(() => prompts.at(-1)[1])).includes('Reviewed summary'));
    await page.locator('[data-summary-position]').selectOption('above');
    assert.equal(await page.evaluate(() => prompts.at(-1)[2]), 0);
    assert.equal(await page.locator('[data-summary-depth]').isDisabled(), true);
    await page.locator('[data-summary-position]').selectOption('chat');
    await page.locator('[data-summary-depth]').fill('0'); await page.locator('[data-summary-depth]').press('Tab');
    assert.deepEqual(await page.evaluate(() => prompts.at(-1).slice(2, 4)), [1, 0]);
    assert.equal(await page.evaluate(() => ctx.extensionSettings.LunarCore.debug.capacity), 3000);
    await page.locator('[data-summary-draft]').fill('Unsaved change');
    await page.evaluate(() => { ctx.saveMetadata = async () => { throw new Error('PRIVATE_ERROR'); }; });
    await page.locator('[data-summary-save]').click();
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('Could not save'));
    assert.equal(await page.evaluate(() => ctx.chatMetadata.LunarCore_summary.text), 'Reviewed summary');
    assert.ok((await page.evaluate(() => prompts.at(-1)[1])).includes('Reviewed summary'));
    await page.evaluate(() => { ctx.saveMetadata = async () => { saves++; }; });
    await page.locator('[data-summary-reload]').click();
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => { ctx.chat[0].mes = 'Changed while waiting'; resolveRequest('Stale result'); });
    await page.waitForFunction(() => document.querySelector('[data-summary-status]').textContent.includes('discarded'));
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), 'Reviewed summary');
    await page.locator('[data-summary-transport]').selectOption('profile');
    await page.locator('[data-summary-profile]').selectOption('p1');
    await page.locator('[data-summary-generate]').click();
    assert.equal(await page.evaluate(() => calls.at(-1)[0]), 'p1');
    await page.evaluate(() => { ctx.chatId = 'b'; ctx.chatMetadata = {}; ctx.chat = [{ name: 'Other', mes: 'Other chat' }]; callbacks.chat.forEach(fn => fn()); });
    assert.equal(await page.evaluate(() => calls.at(-1)[3].signal.aborted), true);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.evaluate(() => resolveRequest({ content: 'Wrong chat' }));
    await page.waitForFunction(() => !document.querySelector('[data-summary-generate]').disabled);
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), '');
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => { callbacks.generation.forEach(fn => fn('normal', {}, false)); resolveRequest({ content: 'Overlapped' }); });
    await page.waitForFunction(() => !document.querySelector('[data-summary-generate]').disabled);
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), '');
    assert.equal(await page.evaluate(() => ctx.chatMetadata.LunarCore_summary), undefined);
    await page.locator('[data-summary-generate]').click();
    await page.locator('[data-summary-cancel]').click();
    await page.evaluate(() => resolveRequest({ content: 'Cancelled' }));
    await page.waitForFunction(() => !document.querySelector('[data-summary-generate]').disabled);
    assert.equal(await page.locator('[data-summary-draft]').inputValue(), '');
    await page.evaluate(() => { ctx.groupId = 'fixture-group'; ctx.characterId = 1; callbacks.chat.forEach(fn => fn()); });
    await page.locator('[data-summary-generate]').click();
    await page.evaluate(() => { ctx.characterId = 2; resolveRequest({ content: 'Group draft' }); });
    await page.waitForFunction(() => document.querySelector('[data-summary-draft]').value === 'Group draft');
    await page.evaluate(() => disposeSummary());
    assert.equal(await page.evaluate(() => callbacks.chat.length), 0);
    assert.equal(await page.evaluate(() => callbacks.generation.length), 0);
    assert.equal(await page.evaluate(() => prompts.at(-1)[1]), '');
    await page.evaluate(async () => {
        ctx.setExtensionPrompt = () => { throw new Error('Unavailable'); };
        const { mountSummary } = await import('/modules/summary/index.js');
        window.disposeAgain = mountSummary(document.getElementById('target'), () => ctx);
    });
    assert.ok((await page.locator('[data-summary-status]').textContent()).includes('injection is unavailable'));
    await page.evaluate(() => disposeAgain());
    assert.deepEqual(errors, []);
    console.log('LunarSummary browser checks passed: manual requests, review/save, injection, stale replies, cancellation and chat isolation.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
