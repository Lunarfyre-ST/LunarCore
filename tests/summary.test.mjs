import test from 'node:test';
import assert from 'node:assert/strict';
import { readSummarySettings, selectMessages, buildRequest, requestSummary, extractSummary } from '../modules/summary/model.js';

test('summarizer defaults to manual, validates limits and selects only recent conversation messages', () => {
    const settings = readSummarySettings({ inject: 'true', messages: 1000, tokens: -1, transport: 'custom' });
    assert.equal(settings.inject, false); assert.equal(settings.messages, 100); assert.equal(settings.tokens, 64); assert.equal(settings.transport, 'main');
    const chat = [{ is_system: true, mes: 'system' }, { is_user: true, name: 'Person', mes: 'First' }, { name: 'Character', mes: 'Reply', swipe_id: 1 }];
    const rows = selectMessages(chat, 2), request = buildRequest(rows, settings.instructions);
    assert.deepEqual(rows.map(row => row.index), [1, 2]);
    assert.ok(request[1].content.includes('First') && request[1].content.includes('Reply'));
    assert.throws(() => selectMessages([{ mes: 'x'.repeat(120001) }], 1), /120,000/);
    assert.throws(() => selectMessages([{ is_system: true, mes: 'system' }], 1), /no conversation/i);
});

test('uses native main/profile APIs and rejects empty, filtered or truncated responses', async () => {
    const calls = [], ctx = { generateRaw: async input => { calls.push(input); return ' Summary '; }, ConnectionManagerRequestService: { sendRequest: async (...args) => { calls.push(args); return { content: 'Profile summary' }; } } };
    const messages = buildRequest(selectMessages([{ mes: 'Hello' }], 1), 'Summarize'), signal = new AbortController().signal;
    assert.equal(await requestSummary(ctx, readSummarySettings(), messages, signal), 'Summary');
    assert.equal(calls[0].responseLength, 512); assert.deepEqual(calls[0].prompt, messages);
    assert.equal(await requestSummary(ctx, readSummarySettings({ transport: 'profile', profile: 'p' }), messages, signal), 'Profile summary');
    assert.equal(calls[1][0], 'p'); assert.equal(calls[1][3].signal, signal);
    await assert.rejects(requestSummary(ctx, readSummarySettings({ transport: 'profile' }), messages, signal), /Choose a connection profile/);
    assert.throws(() => extractSummary({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), /truncated/);
    assert.throws(() => extractSummary(''), /did not return/);
});
