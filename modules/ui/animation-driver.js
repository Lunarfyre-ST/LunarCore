// Bounded fallback for browsers which do not paint the CSS keyframe layers.
// Reads/writes only our decorative nodes, never native UI content.
export function createAnimationDriver({ win, doc, entries, randomize }) {
    let frame = null, disposed = false;
    const smooth = value => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, value)))) / 2;
    function running(entry) {
        return entry.compatibility && (entry.animation.twinkles || entry.animation.sweeps) && !doc.hidden && entry.overlay.classList.contains('lunar-ambient-visible');
    }
    function tick(now) {
        frame = null;
        if (disposed) return;
        let active = false;
        for (const entry of entries()) {
            if (!running(entry)) { entry.lastTick = null; continue; }
            active = true;
            entry.elapsed = (entry.elapsed || 0) + (entry.lastTick === null || entry.lastTick === undefined ? 0 : Math.max(0, now - entry.lastTick));
            entry.lastTick = now;
            if (entry.lastPaint !== undefined && now - entry.lastPaint < 1000 / 24) continue;
            entry.lastPaint = now;
            const config = entry.animation;
            for (const [index, star] of [...entry.overlay.querySelectorAll('.lunar-star')].entries()) {
                const time = entry.elapsed / 1000 + index * 3 + entry.seed % 11;
                const cycle = Math.floor(time / config.twinkleTime), phase = time / config.twinkleTime % 1;
                const previous = entry.cycles.get(star);
                if (config.random && config.twinkles && previous !== undefined && cycle > previous) randomize(star, index);
                entry.cycles.set(star, cycle);
                const pulse = phase < .55 ? smooth((phase - .38) / .17) : 1 - smooth((phase - .55) / .17);
                star.style.opacity = String(config.twinkles ? pulse * config.twinkleStrength * .8 : 0);
            }
            const phase = (entry.elapsed / 1000 + entry.seed % 7 * 2) / config.sweepTime % 1;
            const sheen = entry.overlay.querySelector('.lunar-sheen');
            sheen.style.left = `${-40 + 147 * smooth((phase - .68) / .26)}%`;
            const pulse = phase < .74 ? smooth((phase - .68) / .06) : 1 - smooth((phase - .74) / .2);
            sheen.style.opacity = String(config.sweeps ? pulse * config.sweepStrength : 0);
        }
        if (active) frame = win.requestAnimationFrame(tick);
    }
    function clear(entry) {
        entry.overlay.classList.remove('lunar-compatibility');
        for (const star of entry.overlay.querySelectorAll('.lunar-star')) star.style.removeProperty('opacity');
        const sheen = entry.overlay.querySelector('.lunar-sheen');
        sheen.style.removeProperty('opacity'); sheen.style.removeProperty('left');
        entry.lastTick = null;
    }
    return {
        refresh() {
            if (disposed) return;
            for (const entry of entries()) {
                if (entry.compatibility) {
                    entry.overlay.classList.add('lunar-compatibility');
                    if (!entry.animation.twinkles) for (const star of entry.overlay.querySelectorAll('.lunar-star')) star.style.opacity = '0';
                    if (!entry.animation.sweeps) entry.overlay.querySelector('.lunar-sheen').style.opacity = '0';
                }
                else if (entry.overlay.classList.contains('lunar-compatibility')) clear(entry);
            }
            if (![...entries()].some(running)) {
                if (frame !== null) win.cancelAnimationFrame(frame);
                frame = null;
                for (const entry of entries()) entry.lastTick = null;
            } else if (frame === null) frame = win.requestAnimationFrame(tick);
        },
        dispose() {
            disposed = true;
            if (frame !== null) win.cancelAnimationFrame(frame);
            frame = null;
            for (const entry of entries()) clear(entry);
        },
    };
}
