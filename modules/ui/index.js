import { createSettingsDrawer } from '../../core/settings-panel.js';

export function mountUI(target) {
    const panel = createSettingsDrawer('LunarUI', 'laptop', 'lunar-ui');
    const note = document.createElement('p'); note.textContent = 'UI customization controls will appear here as LunarUI features are added.';
    panel.content.append(note); target.append(panel.drawer);
    return () => panel.drawer.remove();
}
