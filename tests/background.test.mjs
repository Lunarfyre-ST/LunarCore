import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../core/diagnostics.js';
import { readDebugPreferences, saveDebugPreferences } from '../core/debug-preferences.js';

test('routine metadata repeats coalesce across interleaving, while changes stay visible', () => {
    let time = 0;
    const recorder = createRecorder({ now: () => time }); recorder.start();
    for (let i = 0; i < 85; i++) {
        time++;
        recorder.api.emit('context.injection', { enabled: true, promptCharacters: 8139, depth: 1, mode: 'prompt', text: 'PRIVATE' });
        recorder.api.emit('host.settings_updated');
    }
    const contexts = recorder.entries().filter(row => row.event === 'context.injection');
    assert.equal(contexts.length, 1); assert.equal(contexts[0].count, 85);
    assert.equal(contexts[0].lastElapsedMs, 85); assert.equal(contexts[0].phase, 'summary');
    recorder.api.emit('context.injection', { enabled: true, promptCharacters: 8143, depth: 1, mode: 'prompt' });
    assert.equal(recorder.entries().filter(row => row.event === 'context.injection').length, 2);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    assert.equal(recorder.stats().summarized, 168);
    recorder.api.emit('ig.layout', { count: 16, durationMs: 227 });
    recorder.api.emit('ig.layout', { count: 18, durationMs: 262 });
    assert.equal(recorder.entries().at(-1).count, 34);
    assert.equal(recorder.entries().at(-1).durationMs, 489);
});

test('failures fence routine summaries and survive buffer rollover with a bounded history', () => {
    const recorder = createRecorder({ capacity: 3 }); recorder.start();
    recorder.api.emit('context.injection', { promptCharacters: 20 });
    const op = recorder.api.begin('outfit.change'); op.finish({ outcome: 'failed', error: 'PRIVATE' });
    recorder.api.emit('context.injection', { promptCharacters: 20 });
    for (let i = 0; i < 20; i++) recorder.api.emit('ig.setting_change', { setting: 'outfitFadeIn', after: i });
    assert.equal(recorder.stats().attentionCount, 1);
    assert.equal(recorder.attentionEntries()[0].event, 'outfit.change');
    assert.equal(recorder.entries().some(row => row.outcome === 'failed'), false);
    for (let i = 0; i < 210; i++) recorder.api.emit('runtime.error', { outcome: 'failed' });
    assert.equal(recorder.attentionEntries().length, 200);
    assert.equal(recorder.stats().attentionDropped, 11);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    recorder.clear(); assert.equal(recorder.stats().attentionCount, 0); assert.equal(recorder.attentionEntries().length, 0);
});

test('cancellations are distinct from failures; disabled animations are summarized', () => {
    const recorder = createRecorder(); recorder.start();
    for (let i = 0; i < 9; i++) recorder.api.emit('animation.swap', { outcome: 'skipped', reason: 'disabled', kind: 'outfit' });
    recorder.api.begin('animation.background').finish({ outcome: 'cancelled' });
    assert.equal(recorder.entries().find(row => row.event === 'animation.swap').count, 9);
    assert.equal(recorder.stats().attentionCount, 0); assert.equal(recorder.stats().cancelledCount, 1);
});

test('resize retains newest records, reports removals, and preserves live operations', () => {
    const recorder = createRecorder({ capacity: 10 }); recorder.start();
    const op = recorder.api.begin('automation.api');
    for (let i = 0; i < 6; i++) recorder.api.emit('ig.setting_change', { setting: 'outfitFadeIn', after: i });
    recorder.resize(3);
    assert.deepEqual(recorder.entries().map(row => row.after), [3, 4, 5]);
    assert.equal(recorder.stats().dropped, 5);
    recorder.resize(20); op.finish({ outcome: 'completed' });
    assert.equal(recorder.entries().at(-1).outcome, 'completed');
    assert.equal(recorder.stats().capacity, 20);
    for (const bad of [0, 50001, 1.5]) assert.throws(() => recorder.resize(bad), RangeError);
});

test('preferences validate capacity and persist only opt-in settings', () => {
    let saves = 0;
    const context = { extensionSettings: {}, saveSettingsDebounced() { saves++; } };
    assert.deepEqual(readDebugPreferences(context), { capacity: 10000, autoStart: false, autoSave: false });
    saveDebugPreferences(context, { capacity: 20000, autoStart: true, events: ['PRIVATE'] });
    assert.equal(saves, 1); assert.equal(JSON.stringify(context.extensionSettings).includes('PRIVATE'), false);
    assert.deepEqual(readDebugPreferences(context), { capacity: 20000, autoStart: true, autoSave: false });
    context.extensionSettings.LunarCore.debug.capacity = Infinity;
    assert.equal(readDebugPreferences(context).capacity, 10000);
    saveDebugPreferences(context, { capacity: 10000, autoStart: false, autoSave: true, records: ['PRIVATE'] });
    assert.equal(readDebugPreferences(context).autoSave, true);
    assert.equal(JSON.stringify(context.extensionSettings).includes('PRIVATE'), false);
});
