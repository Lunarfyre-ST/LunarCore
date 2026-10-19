import test from 'node:test';
import assert from 'node:assert/strict';
import { needsReview, matchesFilter } from '../core/record-analysis.js';
import { createRecorder } from '../core/diagnostics.js';
test('review separates routine cancellations from inconclusive entrance interruptions', () => {
    assert.equal(needsReview({ event: 'animation.motion', effect: 'breathing', outcome: 'cancelled', reason: 'native_transition' }), false);
    assert.equal(needsReview({ event: 'animation.motion', effect: 'entrance', outcome: 'cancelled', reason: 'native_transition' }), true);
    assert.equal(needsReview({ event: 'animation.motion', outcome: 'cancelled', reason: 'removed' }), false);
    assert.equal(needsReview({ event: 'animation.motion', outcome: 'skipped', reason: 'disabled' }), false);
    assert.equal(needsReview({ outcome: 'failed' }), true);
    assert.equal(matchesFilter({ event: 'motion.lifecycle' }, 'loading'), true);
    assert.equal(matchesFilter({ event: 'animation.motion', effect: 'breathing' }, 'loading'), false);
});
test('coverage and native sprite counts are allowlisted without private identities', () => {
    const recorder = createRecorder(); recorder.start();
    recorder.api.emit('motion.coverage', { motionHooks: true, spriteObserver: true, avatar: 'PRIVATE' });
    recorder.api.emit('sprite.inventory', { count: 3, readyCount: 2, visibleCount: 1, nativeCount: 2, src: 'PRIVATE' });
    recorder.api.emit('sprite.lifecycle', { stage: 'native_state', nativeTransition: true, filename: 'PRIVATE' });
    assert.equal(recorder.entries().at(-1).nativeTransition, true);
    assert.equal(recorder.entries().at(-2).readyCount, 2);
    assert.equal(JSON.stringify(recorder.export()).includes('PRIVATE'), false);
});
