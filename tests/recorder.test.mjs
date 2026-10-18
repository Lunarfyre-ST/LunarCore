import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../core/diagnostics.js';
import { connectImmersiveGroups } from '../integrations/immersivegroups.js';
import { EventEmitter } from 'node:events';

test('off by default; exports only allowlisted metadata, never private text or IDs', () => {
    const recorder = createRecorder();
    recorder.api.emit('outfit.change', { outcome: 'applied' });
    assert.equal(recorder.stats().count, 0);
    recorder.start();
    const secret = 'PRIVATE_PERSON_prompt_path_API_KEY';
    recorder.api.emit(secret, { outcome: 'failed' });
    recorder.api.emit('outfit.change', {
        outcome: 'applied', source: 'manual', committed: true, durationMs: 12.4,
        name: secret, avatar: secret, filename: secret, prompt: secret, error: secret,
        operation: secret, sequence: secret, phase: secret, kind: secret,
        depth: secret, issues: Infinity, failed: NaN, metadata: { text: secret },
    });
    const data = recorder.export({ lunarCore: '0.0.2', immersiveGroups: secret });
    assert.equal(JSON.stringify(data).includes(secret), false);
    assert.equal(data.versions.immersiveGroups, null);
    assert.deepEqual(data.events.at(-1), {
        sequence: 2, elapsedMs: data.events.at(-1).elapsedMs, event: 'outfit.change', phase: 'event',
        outcome: 'applied', source: 'manual', committed: true, durationMs: 12,
    });
    recorder.stop();
    const count = recorder.stats().count;
    recorder.api.emit('context.injection', { promptCharacters: 999 });
    assert.equal(recorder.stats().count, count);
});

test('ring buffer keeps chronological latest events and reports dropped records', () => {
    const recorder = createRecorder({ capacity: 3 });
    recorder.start();
    for (let i = 0; i < 10; i++) recorder.api.emit('context.injection', { promptCharacters: i });
    assert.deepEqual(recorder.entries().map(row => row.promptCharacters), [7, 8, 9]);
    assert.equal(recorder.stats().dropped, 8);
    const copy = recorder.entries(); copy[0].promptCharacters = 500;
    assert.equal(recorder.entries()[0].promptCharacters, 7);
});

test('operations correlate phases and measure duration; stale operations cannot cross sessions', () => {
    let time = 0;
    const recorder = createRecorder({ now: () => time });
    recorder.start();
    const op = recorder.api.begin('outfit.change', { source: 'manual' });
    time = 20;
    op.step({ committed: true });
    time = 35;
    op.finish({ outcome: 'applied' });
    op.finish({ outcome: 'failed' });
    assert.deepEqual(recorder.entries().slice(1).map(row => row.operation), [1, 1, 1]);
    assert.equal(recorder.entries().at(-1).durationMs, 35);
    const stale = recorder.api.begin('automation.api');
    recorder.stop(); recorder.start();
    const count = recorder.stats().count;
    stale.step({ outcome: 'failed' }); stale.finish({ outcome: 'completed' });
    assert.equal(recorder.stats().count, count);
    const cleared = recorder.api.begin('animation.swap');
    recorder.clear(); cleared.finish({ outcome: 'completed' });
    assert.equal(recorder.stats().count, 0);
});

test('integration ignores host/event payloads and removes all subscriptions', () => {
    const recorder = createRecorder(); recorder.start();
    const win = new EventTarget(), doc = new EventTarget(), source = new EventEmitter();
    win.ImmersiveGroups = { diagnosticsProtocol: 1, getStatus: () => ({ status: 'ready', name: 'PRIVATE' }) };
    const disconnect = connectImmersiveGroups(recorder.api, { eventSource: source, eventTypes: { CHAT_CHANGED: 'chat' } }, { win, doc });
    source.emit('chat', { mes: 'PRIVATE', avatar: 'PRIVATE' });
    const event = new Event('ig-layout-change'); event.detail = { name: 'PRIVATE' }; win.dispatchEvent(event);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
    assert.ok(recorder.entries().some(row => row.event === 'host.chat_changed'));
    disconnect();
    assert.equal(source.listenerCount('chat'), 0);
    const count = recorder.stats().count;
    win.dispatchEvent(event); doc.dispatchEvent(new Event('immersivegroups:ready'));
    assert.equal(recorder.stats().count, count);
});

test('invalid capacities cannot create unbounded recordings', () => {
    for (const capacity of [0, -1, Infinity, 50001, 1.5]) assert.throws(() => createRecorder({ capacity }), RangeError);
});
