const HEADER_SELECTOR = '#extensions_settings .inline-drawer-header, #extensions_settings2 .inline-drawer-header, .lunar-theme-preview';
const FLAGS = ['lunar-idle-effects', 'lunar-stars-on', 'lunar-sweeps-on', 'lunar-breathing-on', 'lunar-effects-paused'];

export function createNightEffects({ doc = document, win = window, onStateChange = () => {} } = {}) {
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const hosts = new Map();
    let options = {}, observing = false, disposed = false;
    const visibility = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
        for (const entry of entries) hosts.get(entry.target)?.overlay.classList.toggle('lunar-ambient-visible', entry.isIntersecting);
    }) : null;
    function decorate(host) {
        if (hosts.has(host) || hosts.size >= 80 || !host.isConnected) return;
        const overlay = doc.createElement('span'); overlay.className = 'lunar-ambient';
        overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('inert', '');
        for (let i = 0; i < 4; i++) {
            const star = doc.createElement('span'); star.className = `lunar-star lunar-star-${i}`;
            star.style.setProperty('--lunar-star-delay', `-${i * 3 + hosts.size % 11}s`); overlay.append(star);
        }
        for (const className of ['lunar-sheen', 'lunar-halo']) {
            const layer = doc.createElement('span'); layer.className = className; overlay.append(layer);
        }
        const addedClass = !host.classList.contains('lunar-effects-host');
        overlay.style.setProperty('--lunar-sweep-delay', `-${hosts.size % 7 * 2}s`);
        host.classList.add('lunar-effects-host'); host.append(overlay); hosts.set(host, { overlay, addedClass });
        if (visibility) visibility.observe(host); else overlay.classList.add('lunar-ambient-visible');
    }
    function remove(host) {
        const entry = hosts.get(host);
        if (!entry) return;
        visibility?.unobserve(host); entry.overlay.remove();
        if (entry.addedClass) host.classList.remove('lunar-effects-host');
        hosts.delete(host);
    }
    const observer = new win.MutationObserver(records => {
        // Inspect element structure only, never labels, input values or chat text.
        if (!records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) return;
        for (const [host, entry] of [...hosts]) if (!host.isConnected || !entry.overlay.isConnected) {
            remove(host); if (host.isConnected) decorate(host);
        }
        for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType !== 1 || node.classList.contains('lunar-ambient')) continue;
            if (node.matches(HEADER_SELECTOR)) decorate(node);
            for (const host of node.querySelectorAll(HEADER_SELECTOR)) decorate(host);
        }
    });
    function refresh() {
        if (disposed) return;
        const active = options.enabled === true && !motion.matches;
        doc.body.classList.toggle('lunar-idle-effects', active);
        doc.body.classList.toggle('lunar-stars-on', active && options.twinkles === true);
        doc.body.classList.toggle('lunar-sweeps-on', active && options.sweeps === true);
        doc.body.classList.toggle('lunar-breathing-on', active && options.breathing === true);
        doc.body.classList.toggle('lunar-effects-paused', doc.hidden);
        if (active && !observing) {
            for (const host of doc.querySelectorAll(HEADER_SELECTOR)) decorate(host);
            observer.observe(doc.body, { childList: true, subtree: true }); observing = true;
        } else if (!active && observing) {
            observer.disconnect(); observing = false;
            for (const host of [...hosts.keys()]) remove(host);
        }
        onStateChange({ active, reducedMotion: motion.matches, hidden: doc.hidden });
    }
    motion.addEventListener('change', refresh); doc.addEventListener('visibilitychange', refresh);
    return {
        update(value) {
            options = value;
            doc.body.style.setProperty('--lunar-effect-strength', String(value.intensity / 100));
            doc.body.style.setProperty('--lunar-twinkle-time', `${10 / value.speed}s`);
            doc.body.style.setProperty('--lunar-sweep-time', `${18 / value.speed}s`);
            doc.body.style.setProperty('--lunar-breath-time', `${12 / value.speed}s`);
            refresh();
        },
        dispose() {
            disposed = true; observer.disconnect(); visibility?.disconnect();
            motion.removeEventListener('change', refresh); doc.removeEventListener('visibilitychange', refresh);
            for (const host of [...hosts.keys()]) remove(host);
            doc.body.classList.remove(...FLAGS);
            for (const key of ['--lunar-effect-strength', '--lunar-twinkle-time', '--lunar-sweep-time', '--lunar-breath-time']) doc.body.style.removeProperty(key);
        },
    };
}
