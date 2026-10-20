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

// Counts only retained per-command details, never operation totals or starts.
export function automationFeedback(records) {
    const counts = { applied: 0, unchanged: 0, locked: 0, scope: 0, unavailable: 0, disabled: 0, cancelled: 0, failed: 0, other: 0 };
    for (const row of records) {
        if (row.event !== 'automation.execute' || row.phase !== 'detail' || !['outfit', 'background'].includes(row.kind)) continue;
        const key = row.outcome === 'applied' ? 'applied' : row.outcome === 'failed' ? 'failed' : row.outcome === 'cancelled' ? 'cancelled' : Object.hasOwn(counts, row.reason) ? row.reason : 'other';
        counts[key]++;
    }
    return counts;
}
