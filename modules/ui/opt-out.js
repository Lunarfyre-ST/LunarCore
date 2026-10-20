export const EFFECTS_OPT_OUT = '[data-lunar-ui~="off"], [data-lunar-ui~="effects"]';
export const isEffectsOptedOut = node => Boolean(node?.closest?.(EFFECTS_OPT_OUT));

// Exclude nested extension UI from an ancestor's full-surface decoration too.
// Coordinates only: no labels, inputs or extension state are inspected.
export function clipOptOuts(surface, overlay, win) {
    const roots = [...surface.querySelectorAll(EFFECTS_OPT_OUT)].filter(node => !node.parentElement?.closest(EFFECTS_OPT_OUT));
    if (!roots.length) { overlay.style.removeProperty('clip-path'); overlay.style.removeProperty('visibility'); return; }
    if (roots.length > 128) { overlay.style.visibility = 'hidden'; return; }
    const bounds = overlay.getBoundingClientRect(), width = overlay.clientWidth, height = overlay.clientHeight;
    if (!bounds.width || !bounds.height) return;
    const xScale = width / bounds.width, yScale = height / bounds.height;
    const holes = [];
    for (const node of roots) {
        const rect = node.getBoundingClientRect();
        const left = Math.max(0, (rect.left - bounds.left) * xScale), top = Math.max(0, (rect.top - bounds.top) * yScale);
        const right = Math.min(width, (rect.right - bounds.left) * xScale), bottom = Math.min(height, (rect.bottom - bounds.top) * yScale);
        if (right > left && bottom > top) holes.push({ left, top, right, bottom });
    }
    // Even-odd clipping would unmask overlapping holes. Conservatively merge
    // touching rectangles (including their bounding box) before building paths.
    for (let index = 0; index < holes.length; index++) for (let other = index + 1; other < holes.length; other++) {
        const a = holes[index], b = holes[other];
        if (a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top) {
            holes[index] = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
            holes.splice(other, 1); index = -1; break;
        }
    }
    let path = `M0 0H${width}V${height}H0Z`;
    for (const { left, top, right, bottom } of holes) path += `M${left} ${top}H${right}V${bottom}H${left}Z`;
    const clip = `path(evenodd, "${path}")`;
    if (win.CSS.supports('clip-path', clip)) {
        overlay.style.clipPath = clip; overlay.style.removeProperty('visibility');
    } else overlay.style.visibility = 'hidden'; // Conservative fallback: no spill into opted-out UI.
}
