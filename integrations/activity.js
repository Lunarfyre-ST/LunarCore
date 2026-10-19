import { SETTINGS, settingValue } from '../core/settings-schema.js';

// Fixed windows bound the buffer cost of sliders, scrolling and layout events.
export function createActivity(api, { now = () => performance.now() } = {}) {
    const pending = new Map();
    return {
        add(event, fields = {}, key = event) {
            const time = now(), existing = pending.get(key);
            if (existing) {
                existing.fields = { ...existing.fields, ...fields, before: existing.fields.before, beforeOwnership: existing.fields.beforeOwnership };
                existing.count++; existing.last = time;
            } else pending.set(key, { event, fields: { ...fields }, count: 1, first: time, last: time });
        },
        flush() {
            for (const { event, fields, count, first, last } of pending.values()) api.emit(event, { ...fields, count, durationMs: last - first });
            pending.clear();
        },
        discard() { pending.clear(); },
    };
}

export function createConfigurationTracker(api, activity, settings) {
    let previous = new Map();
    function scan(initial = false) {
        const state = settings();
        if (!state || typeof state !== 'object') return;
        const next = new Map();
        for (const key of Object.keys(SETTINGS)) {
            const scene = key.startsWith('scene.'), local = scene ? key.slice(6) : key;
            const profiles = scene || !['stage', 'sprite', 'layoutSprite'].some(prefix => key.startsWith(prefix)) ? ['shared'] : ['desktop', 'mobile'];
            for (const profile of profiles) {
                const object = scene ? state.sceneAutomation : profile === 'mobile' ? state.mobileLayoutSettings : state;
                // Mobile inherits desktop values when there is no override.
                const inherited = profile === 'mobile' && !Object.hasOwn(object || {}, local);
                const ownership = profile === 'shared' ? 'shared' : inherited ? 'inherited' : 'explicit';
                const raw = inherited ? state[local] : object?.[local];
                const value = settingValue(key, raw);
                if (value === undefined) continue;
                const identity = `${profile}:${key}`;
                next.set(identity, { value, ownership });
                const prior = previous.get(identity);
                if (initial || !prior) api.emit('ig.setting_snapshot', { setting: key, profile, value, ownership });
                else if (prior.value !== value || prior.ownership !== ownership) activity.add('ig.setting_change', { setting: key, profile, before: prior.value, after: value, ownership, beforeOwnership: prior.ownership }, identity);
            }
        }
        previous = next;
    }
    return { scan };
}

const actions = [
    ...Object.entries({ chat: 'layout', controls: 'controls', outfits: 'characters', sprites: 'sprites', animations: 'animations', backgrounds: 'backgrounds', context: 'automation', gallery: 'gallery', original: 'legacy', about: 'about' }).map(([id, name]) => [`#ig-tab-${id}`, `tab.${name}`]),
    ['[data-animation-tab=idle]', 'animation.section_idle'], ['[data-animation-tab=experimental]', 'animation.section_experimental'],
    ['[data-animation-reset]', 'animation_defaults.reset'], ['[data-scene-run]', 'automation.analyze'],
    ['[data-scene-cancel]', 'automation.cancel'], ['[data-scene-apply]', 'automation.apply'],
    ['[data-scene-preview-refresh]', 'context.preview'], ['[data-scene-reset-instructions]', 'context.instructions_reset'],
    ['#ig-open-backgrounds, [data-scene-background-library]', 'background_library.open'],
    ['[data-bg-model-lock]', 'background.lock'], ['[data-media-close]', 'background_picker.close'],
    ['.ig-outfit-rows [role="option"]', 'outfit.select'], ['.prome-stage-outfit', 'outfit_picker.toggle'],
    ['.bg_example', 'background.select'],
    ['.ig-background-popover [data-bg-results] .ig-media-card, .ig-background-dialog [data-bg-use]', 'background.select'],
    ['[data-bg-previous]', 'background.previous'], ['[data-bg-next]', 'background.next'],
];
export function connectActivity(api, activity, tracker, doc) {
    let connected = true;
    const click = event => {
        // Native background proxy clicks are executions, not user UI actions.
        const background = event.target?.closest?.('.bg_example');
        if (background && (background.hidden || background.dataset?.igLinkedManaged === 'true' || background.dataset?.igAutomatic === 'true')) return;
        for (const [selector, action] of actions) if (event.target?.closest?.(selector)) { api.action?.(action, event); break; }
    };
    const change = event => {
        const target = event.target;
        if (target?.id === 'ig-layout-mode') api.action?.('layout.preview_changed', event);
        else if (target?.id === 'ig-edit-layout') api.action?.('layout.editor_changed', event);
        queueMicrotask(() => { if (connected) tracker.scan(); });
    };
    const scroll = event => {
        const target = event.target;
        const area = target?.closest?.('.ig-outfit-options') ? 'outfit_picker'
            : target?.closest?.('.ig-background-popover') ? 'background_picker'
            : target?.closest?.('.ig-live-tuning') ? 'live_tuning'
            : target?.closest?.('.ig-settings-shell') ? 'settings' : null;
        if (area) activity.add('ui.scroll', { area }, `scroll:${area}`);
    };
    doc.addEventListener('click', click, true);
    doc.addEventListener('change', change, true);
    doc.addEventListener('input', change, true);
    doc.addEventListener('scroll', scroll, true);
    return () => {
        connected = false;
        doc.removeEventListener('click', click, true); doc.removeEventListener('change', change, true);
        doc.removeEventListener('input', change, true); doc.removeEventListener('scroll', scroll, true);
    };
}
