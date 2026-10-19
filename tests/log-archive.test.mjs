import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogArchive, createAutoSave, MAX_LOG_BYTES } from '../core/log-archive.js';

test('archive rejects unavailable storage and oversized logs safely', async () => {
    const archive = createLogArchive(null);
    await assert.rejects(archive.list());
    await assert.rejects(archive.save({ text: 'x'.repeat(MAX_LOG_BYTES) }), /large/);
});

test('auto-save coalesces routine work, checkpoints attention and rotates sessions', async () => {
    let time = 0, serial = 0;
    const writes = [], statuses = [];
    const saver = createAutoSave({ archive: { async save(data, id) { writes.push({ data, id }); return id || ++serial; } }, snapshot: () => ({ count: serial }), now: () => time, status: text => statuses.push(text) });
    const stats = { count: 1, revision: 1, attentionCount: 0 };
    await saver.checkpoint(stats); await saver.checkpoint(stats);
    assert.equal(writes.length, 1);
    stats.revision++; await saver.checkpoint(stats); assert.equal(writes.length, 1);
    stats.attentionCount++; await saver.checkpoint(stats); assert.equal(writes.length, 2);
    assert.equal(writes[1].id, 1);
    time = 5001; stats.revision++; await saver.checkpoint(stats); assert.equal(writes.length, 3);
    saver.rotate(); await saver.checkpoint(stats); assert.equal(writes.at(-1).id, undefined);
    assert.equal(statuses.at(-1), 'Saved locally.');
});

test('failed writes report a fixed status and pending checkpoints cannot change new session ownership', async () => {
    const statuses = [], writes = []; let release;
    const saver = createAutoSave({ archive: { save(data, id) { writes.push({ data, id }); return new Promise(resolve => { release = resolve; }); } }, snapshot: () => ({ count: writes.length }), status: text => statuses.push(text) });
    const stats = { count: 1, revision: 1, attentionCount: 0 };
    const pending = saver.checkpoint(stats); await Promise.resolve(); saver.rotate(); release(10); await pending;
    assert.equal(statuses.length, 0);
    const next = saver.checkpoint(stats); await Promise.resolve(); assert.equal(writes.at(-1).id, undefined); release(11); await next;
    const failing = createAutoSave({ archive: { async save() { throw Error('PRIVATE'); } }, snapshot: () => ({}), status: text => statuses.push(text) });
    await failing.checkpoint(stats);
    assert.ok(statuses.at(-1).includes('Could not save'));
    assert.equal(JSON.stringify(statuses).includes('PRIVATE'), false);
});
