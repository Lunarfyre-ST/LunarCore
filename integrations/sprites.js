// Observe native sprite DOM lifetimes without exporting character or asset identities.
// Operation counters are recording-local, never derived from a character or URL.
const selector = '#visual-novel-wrapper .expression-holder img, #ig-mobile-sprites .expression-holder img, #expression-wrapper .expression-holder img';
export function connectSprites(api, { win = window, doc = document } = {}) {
    if (!win.MutationObserver || !doc.body) return () => {};
    const states = new Map();
    let connected = true, frame = null;
    const read = node => {
        const renderer = node.closest('#ig-mobile-sprites') ? 'mobile' : node.closest('#visual-novel-wrapper') ? 'desktop' : 'solo';
        const holder = node.closest('.expression-holder'), style = win.getComputedStyle(node);
        return { renderer, visible: Boolean(node.isConnected && node.getClientRects().length && style.visibility !== 'hidden' && win.getComputedStyle(holder).display !== 'none'),
            imageReady: Boolean(node.complete && node.naturalWidth > 0) };
    };
    function scan() {
        if (!connected) return;
        const found = new Set(doc.querySelectorAll(selector));
        for (const node of found) {
            const fields = read(node), source = node.getAttribute('src') || '';
            let state = states.get(node);
            if (!state) {
                state = { operation: api.begin('sprite.lifecycle', { stage: 'observed', ...fields }), source, ...fields };
                states.set(node, state);
            } else {
                if (source !== state.source) state.operation?.step({ stage: 'source_changed', changed: true, ...fields });
                if (fields.visible !== state.visible || fields.renderer !== state.renderer) state.operation?.step({ stage: 'visibility_changed', ...fields });
                Object.assign(state, fields, { source });
            }
        }
        for (const [node, state] of states) if (!found.has(node)) {
            state.operation?.finish({ stage: 'removed', outcome: 'completed', reason: 'removed' });
            states.delete(node);
        }
    }
    const schedule = () => { if (connected && frame === null) frame = win.requestAnimationFrame(() => { frame = null; scan(); }); };
    const observer = new win.MutationObserver(records => {
        if (records.some(record => record.type === 'childList' || record.target === doc.body || record.target.closest?.('#visual-novel-wrapper,#ig-mobile-sprites,#expression-wrapper'))) schedule();
    });
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'class', 'style', 'hidden'] });
    const loaded = event => {
        const node = event.target;
        if (!node.matches?.(selector)) return;
        // Scan first so a source change and immediate cached load are both visible.
        scan();
        states.get(node)?.operation?.step({ stage: event.type === 'error' ? 'load_error' : 'loaded', ...read(node),
            ...(event.type === 'error' ? { outcome: 'failed', reason: 'error' } : {}) });
    };
    doc.addEventListener('load', loaded, true); doc.addEventListener('error', loaded, true);
    win.addEventListener('resize', schedule);
    scan();
    return () => {
        connected = false; observer.disconnect();
        if (frame !== null) win.cancelAnimationFrame(frame);
        doc.removeEventListener('load', loaded, true); doc.removeEventListener('error', loaded, true);
        win.removeEventListener('resize', schedule);
        for (const state of states.values()) state.operation?.finish({ outcome: 'unobserved', reason: 'recording_stopped' });
        states.clear();
    };
}
