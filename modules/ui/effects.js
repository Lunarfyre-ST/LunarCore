import { EFFECT_AREAS } from './areas.js';

const FLAGS = ['lunar-idle-effects', 'lunar-stars-on', 'lunar-sweeps-on', 'lunar-breathing-on', 'lunar-effects-paused'];

export function createNightEffects({ doc = document, win = window, onStateChange = () => {} } = {}) {
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const hosts = new Map();
    let options = {}, observing = false, disposed = false, frame = null;
    const visibility = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
        for (const entry of entries) hosts.get(entry.target)?.overlay.classList.toggle('lunar-ambient-visible', entry.isIntersecting);
    }) : null;
    const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
    function tune(entry) {
        const local = options.areas[entry.area.id];
        for (const key of ['twinkles', 'sweeps', 'breathing']) {
            entry.overlay.style.setProperty(`--lunar-${key}-strength`, String(options.intensity / 100 * local[key] / 100));
            entry.overlay.classList.toggle(`lunar-no-${key}`, local[key] === 0);
        }
        for (const [key, base] of [['twinkle', 10], ['sweep', 18], ['breath', 12]]) {
            entry.overlay.style.setProperty(`--lunar-${key}-time`, `${base / (options.speed * local.speed)}s`);
        }
    }
    function position(host, entry) {
        if (!entry.area.portal) return;
        const rect = host.getBoundingClientRect();
        let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
        let right = Math.min(win.innerWidth, rect.right), bottom = Math.min(win.innerHeight, rect.bottom), z = 0;
        let hidden = !host.getClientRects().length;
        // Clip external frames to native scroll panels; never add children to chat or forms.
        for (let node = host; node && node !== doc.body; node = node.parentElement) {
            const style = win.getComputedStyle(node);
            hidden ||= style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0;
            z = Math.max(z, Number.parseInt(style.zIndex, 10) || 0);
            if (node !== host && /(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) {
                const bounds = node.getBoundingClientRect();
                left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
                top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
            }
        }
        Object.assign(entry.overlay.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px`,
            zIndex: String(z + 1), borderRadius: win.getComputedStyle(host).borderRadius, display: hidden || right <= left || bottom <= top ? 'none' : '' });
    }
    function decorate(host, area) {
        if (hosts.has(host) || hosts.size >= 80 || !host.isConnected) return;
        const overlay = doc.createElement('span'); overlay.className = 'lunar-ambient'; overlay.dataset.lunarArea = area.id;
        overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('inert', '');
        for (let i = 0; i < 4; i++) {
            const star = doc.createElement('span'); star.className = `lunar-star lunar-star-${i}`;
            star.style.setProperty('--lunar-star-delay', `-${i * 3 + hosts.size % 11}s`); overlay.append(star);
        }
        for (const className of ['lunar-sheen', 'lunar-halo']) {
            const layer = doc.createElement('span'); layer.className = className; overlay.append(layer);
        }
        const addedClass = !area.portal && win.getComputedStyle(host).position === 'static' && !host.classList.contains('lunar-effects-host');
        overlay.style.setProperty('--lunar-sweep-delay', `-${hosts.size % 7 * 2}s`);
        if (area.portal) { overlay.classList.add('lunar-ambient-frame'); doc.body.append(overlay); }
        else { if (addedClass) host.classList.add('lunar-effects-host'); host.append(overlay); }
        const entry = { overlay, addedClass, area }; hosts.set(host, entry); tune(entry); position(host, entry);
        resize?.observe(host);
        if (visibility) visibility.observe(host); else overlay.classList.add('lunar-ambient-visible');
    }
    function remove(host) {
        const entry = hosts.get(host);
        if (!entry) return;
        visibility?.unobserve(host); resize?.unobserve(host); entry.overlay.remove();
        if (entry.addedClass) host.classList.remove('lunar-effects-host');
        hosts.delete(host);
    }
    function sync() {
        frame = null;
        if (!observing || disposed) return;
        const desired = new Map();
        for (const area of EFFECT_AREAS) {
            if (!options.areas[area.id].enabled) continue;
            for (const host of doc.querySelectorAll(area.selector)) {
                // A panel containing another panel gets a single frame, not overlapping frames.
                if (area.id === 'panels' && host.parentElement.closest(area.selector)) continue;
                if (!desired.has(host) && desired.size < 80) desired.set(host, area);
            }
        }
        for (const [host, entry] of hosts) if (!desired.has(host) || !entry.overlay.isConnected) remove(host);
        for (const [host, area] of desired) decorate(host, area);
        for (const [host, entry] of hosts) position(host, entry);
    }
    function schedule() { if (observing && frame === null && !doc.hidden) frame = win.requestAnimationFrame(sync); }
    const observer = new win.MutationObserver(records => {
        // Ignore our decoration mutations and pure text updates; inspect structure only.
        if (records.some(record => {
            if (record.target.closest?.('.lunar-ambient')) return false;
            if (record.type === 'attributes') {
                // Sprite animation/style churn does not require rescanning UI surfaces.
                return EFFECT_AREAS.some(area => record.target.matches?.(area.selector)) ||
                    [...hosts.keys()].some(host => record.target.contains(host));
            }
            return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !node.matches('.lunar-ambient'));
        })) schedule();
    });
    function refresh() {
        if (disposed) return;
        if (frame !== null) win.cancelAnimationFrame(frame); frame = null;
        const active = options.enabled === true && !motion.matches;
        doc.body.classList.toggle('lunar-idle-effects', active);
        for (const [flag, key] of [['lunar-stars-on', 'twinkles'], ['lunar-sweeps-on', 'sweeps'], ['lunar-breathing-on', 'breathing']]) doc.body.classList.toggle(flag, active && options[key] === true);
        doc.body.classList.toggle('lunar-effects-paused', doc.hidden);
        if (active) {
            if (!observing) {
                observing = true;
                observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
            }
            sync();
            for (const entry of hosts.values()) tune(entry);
        } else {
            observing = false; observer.disconnect();
            if (frame !== null) win.cancelAnimationFrame(frame); frame = null;
            for (const host of [...hosts.keys()]) remove(host);
        }
        onStateChange({ active, reducedMotion: motion.matches, hidden: doc.hidden });
    }
    const dragging = event => { if (event.buttons) schedule(); };
    motion.addEventListener('change', refresh); doc.addEventListener('visibilitychange', refresh);
    win.addEventListener('resize', schedule); doc.addEventListener('scroll', schedule, true);
    doc.addEventListener('pointermove', dragging); doc.addEventListener('transitionend', schedule, true);
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
            disposed = true; observing = false; observer.disconnect(); visibility?.disconnect(); resize?.disconnect();
            if (frame !== null) win.cancelAnimationFrame(frame);
            motion.removeEventListener('change', refresh); doc.removeEventListener('visibilitychange', refresh);
            win.removeEventListener('resize', schedule); doc.removeEventListener('scroll', schedule, true);
            doc.removeEventListener('pointermove', dragging); doc.removeEventListener('transitionend', schedule, true);
            for (const host of [...hosts.keys()]) remove(host);
            doc.body.classList.remove(...FLAGS);
            for (const key of ['--lunar-effect-strength', '--lunar-twinkle-time', '--lunar-sweep-time', '--lunar-breath-time']) doc.body.style.removeProperty(key);
        },
    };
}
