// The allowlist is the privacy boundary. Never accept free-form text, IDs,
// filenames, hashes, error messages, prompt bodies, or arbitrary nested data.
import { SETTINGS, ACTIONS, settingValue } from './settings-schema.js';
export const EVENTS = Object.freeze([
    'runtime.error', 'runtime.unhandled_rejection',
    'host.generation_coverage', 'host.generation_after_commands', 'generation.lifecycle',
    'ui.action', 'ui.scroll', 'ui.theme', 'ig.setting_snapshot', 'ig.setting_change', 'ig.configuration',
    'recorder', 'integration', 'outfit.change', 'background.select',
    'background.automatic', 'background.observed', 'animation.swap', 'animation.background', 'animation.motion', 'motion.lifecycle', 'motion.coverage', 'sprite.lifecycle', 'sprite.inventory',
    'automation.execute', 'automation.api', 'context.injection', 'context.history_cleanup',
    'host.chat_changed', 'host.group_updated', 'host.generation_started',
    'host.generation_ended', 'host.generation_stopped', 'host.message_swiped',
    'host.message_edited', 'host.message_deleted', 'host.settings_updated',
    'host.group_started', 'host.group_finished', 'host.member_drafted',
    'ig.layout', 'ig.automation', 'ig.background_catalog', 'ig.outfit_catalog',
    'ig.bindings', 'ig.editor_layout',
]);
const enumFields = {
    theme: ['moonlight_blue'],
    effect: ['expression', 'scene', 'entrance', 'speaking', 'breathing', 'reaction', 'focus', 'backgroundPan'],
    renderer: ['desktop', 'mobile', 'solo', 'other'],
    action: ACTIONS, setting: Object.keys(SETTINGS), profile: ['shared', 'desktop', 'mobile'],
    layout: ['desktop', 'mobile'], area: ['settings', 'live_tuning', 'outfit_picker', 'background_picker', 'library'],
    ownership: ['shared', 'explicit', 'inherited'], beforeOwnership: ['shared', 'explicit', 'inherited'],
    generationType: ['normal', 'quiet', 'impersonate', 'regenerate', 'swipe', 'continue', 'other'],
    stage: ['after_commands', 'completion_not_observed', 'observed', 'source_changed', 'loaded', 'load_error', 'visibility_changed', 'removed', 'load_wait', 'entrance_check', 'restart', 'native_wait', 'node_replaced', 'native_state'],
    source: ['manual', 'automatic', 'other'],
    kind: ['outfit', 'background', 'other'],
    mode: ['cross', 'sequential', 'prompt', 'api', 'other'],
    transport: ['main', 'profile', 'custom', 'other'],
    outcome: ['applied', 'completed', 'skipped', 'cancelled', 'failed', 'requested', 'unobserved', 'pending'],
    reason: ['unavailable', 'scope_or_lock', 'stale', 'unchanged', 'disabled', 'invalid', 'error', 'other',
        'superseded', 'chat_changed', 'layout_changed', 'viewport_changed', 'motion_changed', 'disabled_scene', 'unknown',
        'native_transition', 'node_replaced', 'entrance_active', 'settings_changed', 'source_changed', 'visibility_changed', 'unsupported', 'removed', 'zero_motion', 'finished', 'animation_api', 'user_cancelled', 'dry_run', 'overlapping_start', 'ambiguous_terminal', 'recording_stopped', 'recording_exported', 'end_event', 'stop_event'],
    status: ['absent', 'legacy', 'instrumented', 'starting', 'ready', 'partial', 'failed', 'blocked', 'other'],
};
const numberFields = new Set(['count', 'durationMs', 'inMs', 'outMs', 'characters', 'commands', 'issues', 'applied', 'skipped', 'failed', 'depth', 'promptCharacters', 'messageCount', 'visibleCount', 'readyCount', 'nativeCount']);
const booleanFields = new Set(['enabled', 'automatic', 'dryRun', 'dryRunKnown', 'reducedMotion', 'committed', 'changed',
    'startAvailable', 'endAvailable', 'stopAvailable', 'afterCommandsAvailable', 'preview', 'loop', 'exiting', 'visible', 'imageReady', 'nativeTransition', 'motionHooks', 'spriteObserver']);
function safeFields(input) {
    const result = {};
    if (!input || typeof input !== 'object') return result;
    for (const [key, value] of Object.entries(input)) {
        if (['before', 'after', 'value'].includes(key)) {
            const safe = settingValue(input.setting, value);
            if (safe !== undefined) result[key] = safe;
        }
        else if (Object.hasOwn(enumFields, key) && enumFields[key].includes(value)) result[key] = value;
        else if (numberFields.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9) result[key] = Math.round(value);
        else if (booleanFields.has(key) && typeof value === 'boolean') result[key] = value;
    }
    return result;
}
const safeVersion = value => typeof value === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value) ? value : null;
export const needsAttention = record => record.outcome === 'failed' || record.reason === 'error' ||
    ['failed', 'partial', 'blocked'].includes(record.status) || record.failed > 0 || record.issues > 0;
const routineEvents = new Set(['context.injection', 'context.history_cleanup', 'motion.lifecycle', 'ig.layout', 'ig.editor_layout', 'ui.scroll', 'host.settings_updated']);

export function createRecorder({ capacity = 10000, now = () => performance.now() } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50000) throw new RangeError('Invalid capacity');
    let active = false, session = 0, origin = 0, serial = 0, operation = 0, dropped = 0;
    let revision = 0, summarized = 0, attentionCount = 0, cancelledCount = 0, attentionDropped = 0;
    let unobservedCount = 0;
    const routine = new Map(), hiddenErrors = new Map(), attention = [];
    let actionContext = null;
    const currentCause = () => actionContext && (!actionContext.event || actionContext.event.eventPhase > 0) ? actionContext.id : null;
    let buffer = new Array(capacity), head = 0, size = 0;
    function append(event, phase, data, op, cause = currentCause()) {
        if (!active || !EVENTS.includes(event)) return;
        const fields = safeFields(data), elapsedMs = Math.max(0, Math.round(now() - origin));
        const isAttention = needsAttention(fields);
        if (isAttention) routine.clear();
        const hiddenError = event === 'sprite.lifecycle' && phase === 'detail' && op !== undefined && fields.stage === 'load_error' && fields.visible === false && isAttention;
        if (op !== undefined && !hiddenError) hiddenErrors.delete(op);
        if (hiddenError) {
            const signature = JSON.stringify(fields), prior = hiddenErrors.get(op);
            if (prior?.signature === signature) {
                const record = prior.record;
                record.count = (record.count || 1) + 1; record.lastElapsedMs = elapsedMs;
                record.phase = 'summary'; attentionCount++; summarized++; revision++;
                const retained = attention.find(row => row.sequence === record.sequence);
                if (retained) Object.assign(retained, record);
                return;
            }
        }
        const summarize = phase === 'event' && !isAttention && (routineEvents.has(event) || (event.startsWith('animation.') && fields.outcome === 'skipped' && fields.reason === 'disabled'));
        if (summarize) {
            const { count, durationMs, ...identity } = fields;
            const signature = JSON.stringify(identity), previous = routine.get(event);
            if (previous?.signature === signature) {
                previous.record.count = (previous.record.count || 1) + (count || 1);
                previous.record.lastElapsedMs = elapsedMs;
                if (durationMs !== undefined) previous.record.durationMs = (previous.record.durationMs || 0) + durationMs;
                previous.record.phase = 'summary';
                delete previous.record.causeOperation;
                summarized++; revision++;
                return;
            }
        }
        const record = { sequence: ++serial, elapsedMs, event, phase, ...fields };
        if (op !== undefined) record.operation = op;
        if (hiddenError) hiddenErrors.set(op, { signature: JSON.stringify(fields), record });
        if (cause !== null && cause !== op) record.causeOperation = cause;
        if (summarize) routine.set(event, { signature: JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([key]) => !['count', 'durationMs'].includes(key)))), record });
        if (isAttention) {
            attentionCount++;
            if (attention.length === 200) { attention.shift(); attentionDropped++; }
            attention.push({ ...record });
        }
        if (record.outcome === 'cancelled') cancelledCount++;
        if (record.event === 'generation.lifecycle' && record.phase === 'end' && record.outcome === 'unobserved') unobservedCount++;
        if (size < capacity) buffer[(head + size++) % capacity] = record;
        else {
            const evicted = buffer[head];
            if (hiddenErrors.get(evicted.operation)?.record === evicted) hiddenErrors.delete(evicted.operation);
            for (const [key, value] of routine) if (value.record === evicted) routine.delete(key);
            buffer[head] = record; head = (head + 1) % capacity; dropped++;
        }
        revision++;
    }
    function entries() { return Array.from({ length: size }, (_, i) => ({ ...buffer[(head + i) % capacity] })); }
    function clear() {
        session++; actionContext = null; routine.clear(); hiddenErrors.clear(); attention.length = 0;
        buffer = new Array(capacity); head = size = serial = operation = dropped = 0;
        summarized = attentionCount = cancelledCount = attentionDropped = 0; origin = now(); revision++;
        unobservedCount = 0;
    }
    const api = Object.freeze({
        protocol: 1,
        get enabled() { return active; },
        emit(event, data) { append(event, 'event', data); },
        action(action, event = null) {
            if (!active || !ACTIONS.includes(action)) return;
            const epoch = session, op = ++operation;
            const context = { id: op, event };
            actionContext = context;
            append('ui.action', 'event', { action }, op, null);
            const reset = () => { if (epoch === session && actionContext === context) actionContext = null; };
            // Browser microtasks can run between capture and target listeners.
            // eventPhase prevents attribution after dispatch, even before reset.
            if (event) setTimeout(reset, 0); else queueMicrotask(reset);
        },
        begin(event, data) {
            if (!active || !EVENTS.includes(event)) return null;
            const epoch = session, op = ++operation, started = now(), cause = currentCause();
            let finished = false;
            append(event, 'start', data, op);
            return Object.freeze({
                run(callback) {
                    if (!active || epoch !== session) return callback();
                    const previous = actionContext;
                    actionContext = { id: op, event: null };
                    try { return callback(); } finally { actionContext = previous; }
                },
                step(fields) { if (!finished && active && epoch === session) append(event, 'detail', fields, op, cause); },
                finish(fields) {
                    if (finished) return;
                    finished = true;
                    if (active && epoch === session) append(event, 'end', { ...fields, durationMs: Math.max(0, now() - started) }, op, cause);
                },
            });
        },
    });
    return {
        api,
        start() { if (!active) { session++; routine.clear(); if (!serial) origin = now(); active = true; append('recorder', 'event', { enabled: true }); } },
        stop() { if (active) { append('recorder', 'event', { enabled: false }); active = false; routine.clear(); hiddenErrors.clear(); actionContext = null; session++; } },
        clear, entries,
        attentionEntries() { return attention.map(record => ({ ...record })); },
        resize(nextCapacity) {
            if (!Number.isInteger(nextCapacity) || nextCapacity < 1 || nextCapacity > 50000) throw new RangeError('Invalid capacity');
            const all = entries(), retained = all.slice(-nextCapacity);
            dropped += all.length - retained.length; capacity = nextCapacity;
            buffer = new Array(capacity); head = 0; size = retained.length;
            retained.forEach((record, index) => { buffer[index] = record; });
            routine.clear(); hiddenErrors.clear(); revision++;
        },
        stats() { return { active, count: size, dropped, capacity, summarized, attentionCount, cancelledCount, unobservedCount, attentionRetained: attention.length, attentionDropped, revision }; },
        export(versions = {}) {
            return { schema: 'lunar-debug-recording', schemaVersion: 4, protocolVersion: 1,
                versions: { lunarCore: safeVersion(versions.lunarCore), immersiveGroups: safeVersion(versions.immersiveGroups) },
                ...this.stats(), attentionEvents: attention.map(record => ({ ...record })), events: entries() };
        },
    };
}
