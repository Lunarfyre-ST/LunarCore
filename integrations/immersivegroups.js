import { createActivity, createConfigurationTracker, connectActivity } from './activity.js';

const hostEvents = {
    CHAT_CHANGED: 'chat_changed', GROUP_CHAT_CHANGED: 'chat_changed', GROUP_UPDATED: 'group_updated',
    GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
    GENERATION_STOPPED: 'generation_stopped', MESSAGE_SWIPED: 'message_swiped',
    MESSAGE_EDITED: 'message_edited', MESSAGE_DELETED: 'message_deleted', SETTINGS_UPDATED: 'settings_updated',
    GROUP_WRAPPER_STARTED: 'group_started', GROUP_WRAPPER_FINISHED: 'group_finished', GROUP_MEMBER_DRAFTED: 'member_drafted',
};
const featureEvents = {
    'ig-layout-change': 'layout', 'ig-automation-state-change': 'automation',
    'ig-background-catalog-change': 'background_catalog', 'ig-outfit-catalog-change': 'outfit_catalog',
    'ig-binding-groups-change': 'bindings', 'ig-editor-layout-change': 'editor_layout',
};
export function connectImmersiveGroups(api, context, { win = window, doc = document } = {}) {
    const cleanups = [];
    let connected = true;
    const activity = createActivity(api);
    const tracker = createConfigurationTracker(api, activity, () => (context.extensionSettings || context.extension_settings)?.ImmersiveGroups);
    const listen = (target, name, handler) => { target.addEventListener(name, handler); cleanups.push(() => target.removeEventListener(name, handler)); };
    function snapshot() {
        const ig = win.ImmersiveGroups;
        api.emit('integration', { status: !ig ? 'absent' : ig.diagnosticsProtocol === 1 ? 'instrumented' : 'legacy' });
        if (ig?.getStatus) { try { api.emit('integration', { status: ig.getStatus().status }); } catch { api.emit('integration', { status: 'failed' }); } }
        tracker.scan(true);
        const state = (context.extensionSettings || context.extension_settings)?.ImmersiveGroups;
        const layout = state?.layoutMode === 'mobile' || (state?.layoutMode !== 'desktop' && win.innerWidth <= (Number(state?.mobileLayoutWidth) || 1000)) ? 'mobile' : 'desktop';
        api.emit('ig.configuration', { layout, reducedMotion: Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) });
    }
    listen(doc, 'immersivegroups:ready', snapshot);
    // Detect browser-reported failures without inspecting messages, stacks,
    // URLs, rejection values, or claiming which extension caused them.
    listen(win, 'error', () => api.emit('runtime.error', { outcome: 'failed', reason: 'error' }));
    listen(win, 'unhandledrejection', () => api.emit('runtime.unhandled_rejection', { outcome: 'failed', reason: 'error' }));
    for (const [name, suffix] of Object.entries(featureEvents)) listen(win, name, () => {
        tracker.scan();
        if (suffix === 'layout' || suffix === 'editor_layout') activity.add(`ig.${suffix}`);
        else api.emit(`ig.${suffix}`);
    });
    cleanups.push(connectActivity(api, activity, tracker, doc));
    const timer = setInterval(() => { if (connected) { tracker.scan(); activity.flush(); } }, 500);
    cleanups.push(() => clearInterval(timer));
    // The CSS URL is compared locally and never enters the recorder. This
    // observes native background changes even when animations are disabled.
    if (win.MutationObserver && doc.body) {
        let node = null, previous = '', surface = null;
        const attach = () => {
            const current = doc.getElementById('bg1');
            if (current === node) return;
            surface?.disconnect(); node = current; previous = node?.style.backgroundImage || '';
            if (!node) return;
            surface = new win.MutationObserver(() => {
                const value = node.style.backgroundImage;
                if (value !== previous) { previous = value; api.emit('background.observed', { changed: true }); }
            });
            surface.observe(node, { attributes: true, attributeFilter: ['style'] });
        };
        const discovery = new win.MutationObserver(attach);
        discovery.observe(doc.body, { childList: true, subtree: true });
        attach();
        cleanups.push(() => { discovery.disconnect(); surface?.disconnect(); node = null; previous = ''; });
    }
    const source = context.eventSource, types = context.eventTypes || context.event_types || {};
    // Do not subscribe without a matching cleanup method. Event arguments are
    // deliberately ignored; they often contain messages and character names.
    const remove = source?.removeListener || source?.off;
    if (source?.on && remove) for (const [name, suffix] of Object.entries(hostEvents)) {
        if (!types[name]) continue;
        const handler = () => { if (suffix === 'settings_updated') tracker.scan(); api.emit(`host.${suffix}`); };
        source.on(types[name], handler);
        cleanups.push(() => remove.call(source, types[name], handler));
    }
    snapshot();
    const dispose = (discard = false) => {
        if (!connected) return;
        connected = false;
        for (const cleanup of cleanups.reverse()) cleanup();
        if (discard) activity.discard(); else activity.flush();
    };
    dispose.flush = () => { if (connected) { tracker.scan(); activity.flush(); } };
    return dispose;
}
