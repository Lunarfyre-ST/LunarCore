import { needsAttention } from './diagnostics.js';
// A review candidate is evidence to inspect, never a declaration of a bug.
export function needsReview(record) {
    if (needsAttention(record)) return true;
    if (record.event !== 'animation.motion') return false;
    if (record.outcome === 'skipped' && record.reason === 'unsupported') return true;
    return record.outcome === 'cancelled' && (['stale', 'unknown'].includes(record.reason) ||
        (record.effect === 'entrance' && ['source_changed', 'native_transition'].includes(record.reason)));
}
export function matchesFilter(record, filter) {
    if (filter === 'review') return needsReview(record);
    if (filter === 'loading') return record.event.startsWith('sprite.') || record.event === 'motion.lifecycle' || record.event === 'motion.coverage' || (record.event === 'animation.motion' && record.effect === 'entrance');
    return !filter || record.event.startsWith(filter);
}
