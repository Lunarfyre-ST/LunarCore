import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../core/diagnostics.js';
import { createActivity, createConfigurationTracker } from '../integrations/activity.js';

test('configuration snapshots/diffs exclude private settings and respect profiles', () => {
    const recorder = createRecorder(); recorder.start();
    const activity = createActivity(recorder.api);
    const settings = { outfitFadeIn: 200, stageGap: 8, mobileLayoutSettings: { stageGap: 12 },
        sceneAutomation: { enabled: true, apiUrl: 'PRIVATE', apiModel: 'PRIVATE', instructionsAll: 'PRIVATE', apiTransport: 'custom' },
        characterName: 'PRIVATE', outfitCatalog: { PRIVATE: {} } };
    const tracker = createConfigurationTracker(recorder.api, activity, () => settings);
    tracker.scan(true);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    assert.ok(recorder.entries().some(row => row.profile === 'mobile' && row.setting === 'stageGap' && row.value === 12));
    settings.outfitFadeIn = 250; tracker.scan();
    settings.outfitFadeIn = 350; tracker.scan();
    settings.sceneAutomation.apiUrl = 'PRIVATE_CHANGED'; tracker.scan();
    activity.flush();
    const changes = recorder.entries().filter(row => row.event === 'ig.setting_change');
    assert.equal(changes.length, 1);
    assert.deepEqual([changes[0].before, changes[0].after, changes[0].count], [200, 350, 2]);
    recorder.api.emit('ig.setting_change', { setting: 'outfitFadeIn', before: 'PRIVATE', after: 99999 });
    assert.equal(recorder.entries().at(-1).before, undefined);
    assert.equal(recorder.entries().at(-1).after, undefined);
    recorder.api.emit('ig.setting_snapshot', { setting: 'scene.apiTransport', value: 'PRIVATE' });
    assert.equal(recorder.entries().at(-1).value, undefined);
});

test('layout bursts are summarized and discarded bursts cannot leak after clear', () => {
    const recorder = createRecorder(); recorder.start();
    let time = 0;
    const activity = createActivity(recorder.api, { now: () => time });
    for (let i = 0; i < 753; i++) { time = i; activity.add('ig.layout'); }
    activity.flush();
    assert.equal(recorder.entries().at(-1).count, 753);
    assert.equal(recorder.entries().at(-1).durationMs, 752);
    activity.add('ui.scroll', { area: 'settings' }); activity.discard(); activity.flush();
    assert.equal(recorder.entries().filter(row => row.event === 'ui.scroll').length, 0);
});

test('action correlation is retained through an operation but never guessed for later work', async () => {
    const recorder = createRecorder(); recorder.start();
    recorder.api.action('automation.analyze');
    const action = recorder.entries().at(-1);
    const operation = recorder.api.begin('automation.api', { transport: 'main' });
    await Promise.resolve();
    operation.finish({ outcome: 'completed' });
    assert.equal(recorder.entries().at(-1).causeOperation, action.operation);
    recorder.api.begin('outfit.change');
    assert.equal(recorder.entries().at(-1).causeOperation, undefined);
    recorder.api.action('PRIVATE');
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
});
