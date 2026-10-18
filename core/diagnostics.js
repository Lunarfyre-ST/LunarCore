// The allowlist is the privacy boundary. Never accept free-form text, IDs,
// filenames, hashes, error messages, prompt bodies, or arbitrary nested data.
import { SETTINGS, ACTIONS, settingValue } from './settings-schema.js';
export const EVENTS = Object.freeze([
    'ui.action', 'ui.scroll', 'ig.setting_snapshot', 'ig.setting_change', 'ig.configuration',
    'recorder', 'integration', 'outfit.change', 'background.select',
    'background.automatic', 'background.observed', 'animation.swap', 'animation.background',
    'automation.execute', 'automation.api', 'context.injection', 'context.history_cleanup',
    'host.chat_changed', 'host.group_updated', 'host.generation_started',
    'host.generation_ended', 'host.generation_stopped', 'host.message_swiped',
    'host.message_edited', 'host.message_deleted', 'host.settings_updated',
    'host.group_started', 'host.group_finished', 'host.member_drafted',
    'ig.layout', 'ig.automation', 'ig.background_catalog', 'ig.outfit_catalog',
    'ig.bindings', 'ig.editor_layout',
]);
const enumFields = {
    action: ACTIONS, setting: Object.keys(SETTINGS), profile: ['shared', 'desktop', 'mobile'],
    layout: ['desktop', 'mobile'], area: ['settings', 'live_tuning', 'outfit_picker', 'background_picker', 'library'],
    source: ['manual', 'automatic', 'other'],
    kind: ['outfit', 'background', 'other'],
    mode: ['cross', 'sequential', 'prompt', 'api', 'other'],
    transport: ['main', 'profile', 'custom', 'other'],
    outcome: ['applied', 'completed', 'skipped', 'cancelled', 'failed', 'requested'],
    reason: ['unavailable', 'scope_or_lock', 'stale', 'unchanged', 'disabled', 'invalid', 'error', 'other'],
    status: ['absent', 'legacy', 'instrumented', 'starting', 'ready', 'partial', 'failed', 'blocked', 'other'],
};
const numberFields = new Set(['count', 'durationMs', 'inMs', 'outMs', 'characters', 'commands', 'issues', 'applied', 'skipped', 'failed', 'depth', 'promptCharacters', 'messageCount']);
const booleanFields = new Set(['enabled', 'automatic', 'dryRun', 'reducedMotion', 'committed', 'changed']);
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

export function createRecorder({ capacity = 10000, now = () => performance.now() } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50000) throw new RangeError('Invalid capacity');
    let active = false, session = 0, origin = 0, serial = 0, operation = 0, dropped = 0;
    let actionContext = null;
    const currentCause = () => actionContext && (!actionContext.event || actionContext.event.eventPhase > 0) ? actionContext.id : null;
    let buffer = new Array(capacity), head = 0, size = 0;
    function append(event, phase, data, op, cause = currentCause()) {
        if (!active || !EVENTS.includes(event)) return;
        const record = { sequence: ++serial, elapsedMs: Math.max(0, Math.round(now() - origin)), event, phase, ...safeFields(data) };
        if (op !== undefined) record.operation = op;
        if (cause !== null && cause !== op) record.causeOperation = cause;
        if (size < capacity) buffer[(head + size++) % capacity] = record;
        else { buffer[head] = record; head = (head + 1) % capacity; dropped++; }
    }
    function entries() { return Array.from({ length: size }, (_, i) => ({ ...buffer[(head + i) % capacity] })); }
    function clear() { session++; actionContext = null; buffer = new Array(capacity); head = size = serial = operation = dropped = 0; origin = now(); }
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
        start() { if (!active) { session++; if (!serial) origin = now(); active = true; append('recorder', 'event', { enabled: true }); } },
        stop() { if (active) { append('recorder', 'event', { enabled: false }); active = false; actionContext = null; session++; } },
        clear, entries,
        stats() { return { active, count: size, dropped, capacity }; },
        export(versions = {}) {
            return { schema: 'lunar-debug-recording', schemaVersion: 2, protocolVersion: 1,
                versions: { lunarCore: safeVersion(versions.lunarCore), immersiveGroups: safeVersion(versions.immersiveGroups) },
                ...this.stats(), events: entries() };
        },
    };
}
