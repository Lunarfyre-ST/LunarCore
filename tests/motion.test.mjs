import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../core/diagnostics.js';
import { createActivity, createConfigurationTracker } from '../integrations/activity.js';
import { settingValue } from '../core/settings-schema.js';

test('motion settings are typed, shared and preserve fractional strength', () => {
    const recorder = createRecorder(); recorder.start();
    const activity = createActivity(recorder.api);
    const settings = { breathingMotionEnabled: true, breathingMotionStrength: 0.6, entranceMotionDuration: 350,
        backgroundPanMotionDirection: 'left', reactionMotionStyle: 'shake', privateName: 'PRIVATE' };
    const tracker = createConfigurationTracker(recorder.api, activity, () => settings);
    tracker.scan(true);
    assert.ok(recorder.entries().some(r => r.setting === 'breathingMotionStrength' && r.value === 0.6 && r.profile === 'shared'));
    settings.entranceMotionDuration = 700; tracker.scan(); activity.flush();
    assert.equal(recorder.entries().at(-1).after, 700);
    assert.equal(settingValue('breathingMotionStrength', 4), undefined);
    assert.equal(settingValue('reactionMotionStyle', 'PRIVATE'), undefined);
    assert.equal(settingValue('backgroundPanMotionDuration', 120001), undefined);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
});

test('motion operations retain safe outcomes and cannot cross recording sessions', () => {
    const recorder = createRecorder(); recorder.start();
    const op = recorder.api.begin('animation.motion', { effect: 'entrance', preview: false, loop: false, avatar: 'PRIVATE' });
    op.finish({ outcome: 'cancelled', reason: 'superseded' });
    assert.equal(recorder.stats().cancelledCount, 1);
    const old = recorder.api.begin('animation.motion', { effect: 'breathing', loop: true });
    recorder.clear(); old.finish({ outcome: 'failed' });
    assert.equal(recorder.stats().attentionCount, 0);
    const current = recorder.api.begin('sprite.lifecycle', { stage: 'observed', renderer: 'desktop', visible: true, imageReady: false });
    current.step({ stage: 'load_error', outcome: 'failed', reason: 'error', src: 'PRIVATE' });
    current.finish({ stage: 'removed', outcome: 'completed', reason: 'removed' });
    assert.equal(recorder.stats().attentionCount, 1);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    const stopped = recorder.api.begin('animation.motion'); recorder.stop(); recorder.start();
    const count = recorder.stats().count; stopped.finish({ outcome: 'completed' });
    assert.equal(recorder.stats().count, count);
});
