// Explicit background → decoration → native content ordering. Only classes are
// added; message bodies/inputs are never read or rewritten.
export function createContentLayers(surface, overlay, win) {
    const owned = new Map();
    function add(node, name) {
        if (node.classList.contains(name)) return;
        node.classList.add(name);
        if (!owned.has(node)) owned.set(node, []);
        owned.get(node).push(name);
    }
    add(surface, 'lunar-layer-surface');
    if (win.getComputedStyle(surface).position === 'static') add(surface, 'lunar-effects-host');
    return {
        refresh() {
            for (const node of [...owned.keys()]) if (node !== surface && !surface.contains(node)) {
                node.classList.remove(...owned.get(node)); owned.delete(node);
            }
            for (const child of surface.children) {
                if (child === overlay || child.matches('.lunar-ambient')) continue;
                // Leave normal message backgrounds below decoration; lift native
                // text/media/actions instead of lifting the entire message panel.
                const content = surface.id === 'chat' && child.matches('.mes')
                    ? child.querySelectorAll('.mes_block, .mesAvatarWrapper, .mes_text, .mes_buttons, .ch_name, .avatar')
                    : [child];
                if (surface.id === 'chat' && child.matches('.mes')) add(child, 'lunar-message-base');
                for (const node of content) {
                    add(node, 'lunar-content-layer');
                    if (win.getComputedStyle(node).position === 'static') add(node, 'lunar-content-position');
                }
            }
        },
        dispose() { for (const [node, names] of owned) node.classList.remove(...names); owned.clear(); },
    };
}
