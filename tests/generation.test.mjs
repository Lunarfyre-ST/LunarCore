import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRecorder } from '../core/diagnostics.js';
import { connectGeneration } from '../integrations/generation.js';

function fixture() {
    const recorder = createRecorder(); recorder.start();
    const source = new EventEmitter();
    const names = ['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'GENERATION_AFTER_COMMANDS', 'CHAT_CHANGED'];
    const tracker = connectGeneration(recorder.api, { eventSource: source, eventTypes: Object.fromEntries(names.map(key => [key, key])) });
    return { recorder, source, tracker };
}

test('dry runs and quiet requests record only safe lifecycle metadata', () => {
    const { recorder, source, tracker } = fixture();
    const privateOptions = { quiet_prompt: 'PRIVATE', quietName: 'PRIVATE', quietImage: 'PRIVATE', force_chid: 'PRIVATE', automatic_trigger: true };
    source.emit('GENERATION_STARTED', 'quiet', privateOptions, true);
    source.emit('GENERATION_AFTER_COMMANDS', 'quiet', privateOptions, true);
    tracker.dispose();
    assert.equal(recorder.stats().unobservedCount, 0);
    assert.ok(recorder.entries().some(row => row.reason === 'dry_run' && row.generationType === 'quiet'));
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    assert.equal(recorder.stats().attentionCount, 0);
});

test('real completion and stop are observed without inspecting terminal payloads', () => {
    const { recorder, source, tracker } = fixture();
    source.emit('GENERATION_STARTED', undefined, {}, false);
    source.emit('GENERATION_AFTER_COMMANDS', undefined, {}, false);
    source.emit('GENERATION_ENDED', { mes: 'PRIVATE' });
    source.emit('GENERATION_STARTED', 'impersonate', {}, false);
    source.emit('GENERATION_STOPPED', 'PRIVATE');
    tracker.dispose();
    const endings = recorder.entries().filter(row => row.event === 'generation.lifecycle' && row.phase === 'end');
    assert.deepEqual(endings.map(row => [row.outcome, row.reason]), [['completed', 'end_event'], ['cancelled', 'stop_event']]);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    assert.equal(recorder.stats().attentionCount, 0);
});

test('export, chat switches, overlapping requests and recorder stop do not invent failures', () => {
    const { recorder, source, tracker } = fixture();
    source.emit('GENERATION_STARTED', 'normal', {}, false); tracker.report();
    assert.equal(recorder.entries().at(-1).outcome, 'pending');
    source.emit('CHAT_CHANGED', 'PRIVATE');
    assert.equal(recorder.entries().at(-1).reason, 'chat_changed');
    source.emit('GENERATION_ENDED');
    source.emit('GENERATION_STARTED', 'normal', {}, false);
    source.emit('GENERATION_STARTED', 'quiet', {}, false);
    source.emit('GENERATION_ENDED');
    assert.equal(recorder.entries().at(-1).reason, 'ambiguous_terminal');
    source.emit('GENERATION_STARTED', 'normal', {}, false); tracker.dispose();
    assert.equal(recorder.entries().at(-1).reason, 'recording_stopped');
    assert.equal(recorder.stats().unobservedCount, 4);
    assert.equal(recorder.stats().attentionCount, 0);
    assert.equal(source.listenerCount('GENERATION_STARTED'), 0);
});

test('coverage reports unavailable terminal events; discarded sessions emit no endings', () => {
    const recorder = createRecorder(); recorder.start();
    const source = new EventEmitter();
    const tracker = connectGeneration(recorder.api, { eventSource: source, eventTypes: { GENERATION_STARTED: 'start' } });
    const coverage = recorder.entries().at(-1);
    assert.equal(coverage.startAvailable, true); assert.equal(coverage.endAvailable, false);
    source.emit('start', 'PRIVATE', { text: 'PRIVATE' }, false);
    tracker.dispose(true); recorder.clear();
    source.emit('start', 'normal', {}, false);
    assert.equal(recorder.stats().count, 0);
});
