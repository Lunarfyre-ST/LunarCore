import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export default async function debugFeatures(browser, url, prefix) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('.lunar-core > summary').click(); await page.locator('.lunar-debug > summary').click();
    assert.equal(await page.locator('[data-auto-save]').isChecked(), false);
    await page.locator('[data-record]').check();
    await page.locator('[data-auto-save]').check();
    await page.waitForFunction(() => document.querySelector('[data-save-status]').textContent === 'Saved locally.');
    await page.evaluate(async prefix => {
        const settings = (await import('/scripts/extensions.js')).extension_settings.ImmersiveGroups;
        Object.assign(settings, { entranceMotionEnabled: true, entranceMotionDuration: 300, entranceMotionStrength: 24, entranceMotionStyle: 'slide', breathingMotionEnabled: false });
        ctx.extensionSettings.ImmersiveGroups = settings;
        ctx.characters = [{ avatar: 'PRIVATE' }]; ctx.characterId = 0; ctx.getCurrentChatId = () => 'PRIVATE';
        const root = document.createElement('div'); root.id = 'expression-wrapper';
        root.innerHTML = '<div class="expression-holder" id="expression-holder"><img width="50" height="50"></div>';
        document.body.append(root);
        window.motion = await import(prefix + 'modules/scene-motion.js'); motion.setupSceneMotion();
        window.testImage = root.querySelector('img');
        testImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='red'/%3E%3C/svg%3E";
    }, prefix);
    await page.waitForFunction(() => testImage.getAnimations().length > 0);
    await page.waitForFunction(() => testImage.getAnimations().length === 0);
    await page.evaluate(() => {
        testImage.closest('.expression-holder').style.display = 'none';
    });
    await page.waitForTimeout(40);
    await page.evaluate(() => { testImage.closest('.expression-holder').style.display = ''; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { testImage.src += '%20'; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { testImage.dispatchEvent(new Event('error')); testImage.closest('#expression-wrapper').remove(); });
    await page.waitForTimeout(40);
    // Poll persisted data explicitly: reload must not outrun an IndexedDB commit.
    let persisted = false;
    for (let attempt = 0; attempt < 20 && !persisted; attempt++) {
        persisted = await page.evaluate(async () => (await (await import('/core/log-archive.js')).createLogArchive().list()).some(entry => JSON.parse(entry.json).attentionCount > 0));
        if (!persisted) await page.waitForTimeout(100);
    }
    assert.equal(persisted, true);
    const exported = page.waitForEvent('download'); await page.locator('[data-export]').click();
    const data = JSON.parse(await readFile(await (await exported).path(), 'utf8'));
    assert.ok(data.events.some(row => row.event === 'animation.motion' && row.effect === 'entrance' && row.phase === 'start' && !row.preview));
    assert.ok(data.events.some(row => row.event === 'animation.motion' && row.outcome === 'completed'));
    for (const stage of ['observed', 'loaded', 'source_changed', 'visibility_changed', 'load_error', 'removed']) assert.ok(data.events.some(row => row.event === 'sprite.lifecycle' && row.stage === stage), stage);
    assert.ok(data.events.some(row => row.setting === 'entranceMotionEnabled' && row.value === true));
    assert.equal(JSON.stringify(data).includes('PRIVATE'), false);
    await page.locator('[data-open-logs]').click();
    await page.waitForFunction(() => document.querySelector('[data-log-list]').textContent.includes('Saved log'));
    await page.reload();
    await page.locator('.lunar-core > summary').click(); await page.locator('.lunar-debug > summary').click();
    assert.equal(await page.locator('[data-record]').isChecked(), false);
    await page.locator('[data-open-logs]').click();
    await page.waitForFunction(() => document.querySelector('[data-log-list]').textContent.includes('Saved log'));
    const savedExport = page.waitForEvent('download'); await page.locator('[data-log-list]').getByRole('button', { name: 'Export JSON' }).first().click();
    const restored = JSON.parse(await readFile(await (await savedExport).path(), 'utf8'));
    assert.ok(restored.attentionCount > 0);
    // IndexedDB retention replaces a checkpoint and prunes older recordings.
    await page.evaluate(async () => {
        const { createLogArchive } = await import('/core/log-archive.js'); const archive = createLogArchive();
        const id = await archive.save({ count: 1 }); await archive.save({ count: 2 }, id);
        for (let i = 0; i < 7; i++) await archive.save({ count: i });
        const entries = await archive.list(); if (entries.length !== 5) throw Error('Retention failure');
        for (const entry of entries) await archive.remove(entry.id);
    });
    await page.locator('[data-open-logs]').click(); await page.locator('[data-open-logs]').click();
    await page.waitForFunction(() => document.querySelector('[data-log-list]').textContent === 'No saved logs yet.');
    assert.deepEqual(errors, []); await page.close();
    console.log('PASS: motion traces, anonymous sprite lifecycle/load errors, auto-save, reload recovery, JSON export, deletion and bounded IndexedDB retention.');
}
