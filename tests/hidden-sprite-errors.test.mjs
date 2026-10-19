import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../core/diagnostics.js';
test('repeated hidden sprite errors retain observation counts, timing and lifecycle boundaries', () => {
    let time = 0;
    const recorder = createRecorder({ now: () => time }); recorder.start();
    const op = recorder.api.begin('sprite.lifecycle', { stage: 'observed', visible: false });
    const error = { stage: 'load_error', visible: false, imageReady: false, outcome: 'failed', reason: 'error' };
    for (let i = 0; i < 41; i++) { time += 2000; op.step(error); }
    let errors = recorder.entries().filter(row => row.stage === 'load_error');
    assert.equal(errors.length, 1); assert.equal(errors[0].count, 41);
    assert.equal(errors[0].elapsedMs, 2000); assert.equal(errors[0].lastElapsedMs, 82000);
    assert.equal(recorder.stats().attentionCount, 41); assert.equal(recorder.stats().attentionRetained, 1);
    assert.deepEqual(recorder.attentionEntries()[0], errors[0]);
    op.step({ stage: 'source_changed', changed: true }); op.step(error);
    assert.equal(recorder.entries().filter(row => row.stage === 'load_error').length, 2);
    op.step({ stage: 'visibility_changed', visible: true }); op.step({ ...error, visible: true }); op.step({ ...error, visible: true });
    assert.equal(recorder.entries().filter(row => row.stage === 'load_error').length, 4);
    recorder.resize(1); op.step(error); assert.equal(recorder.entries()[0].count, undefined);
    recorder.clear(); op.step(error); assert.equal(recorder.stats().count, 0);
});
