import { createSettingsDrawer } from '../../core/settings-panel.js';

export function mountUI(target, context, { onChange = () => {} } = {}) {
    const panel = createSettingsDrawer('LunarUI', 'laptop', 'lunar-ui');
    const settings = context.extensionSettings || context.extension_settings;
    let enabled = settings?.LunarCore?.ui?.moonlightBlue === true;
    const label = document.createElement('label'); label.className = 'lunar-theme-toggle';
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.dataset.moonlight = ''; toggle.checked = enabled;
    label.append(toggle, document.createTextNode('Moonlight Blue'));
    const note = document.createElement('p'); note.textContent = 'Cool blue panels and accents with a soft glow. Turn off to return to your current SillyTavern theme.';
    const preview = document.createElement('div'); preview.className = 'lunar-moonlight-preview'; preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = '<span class="lunar-preview-moon">☾</span><span>Moonlight Blue</span><span class="lunar-preview-swatch"></span>';
    const status = document.createElement('small'); status.setAttribute('role', 'status');
    function apply() {
        document.body.classList.toggle('lunar-moonlight', enabled);
        status.textContent = enabled ? 'Moonlight Blue is active.' : 'Your SillyTavern theme is active.';
    }
    toggle.addEventListener('change', () => {
        enabled = toggle.checked;
        if (settings) { settings.LunarCore ||= {}; settings.LunarCore.ui = { moonlightBlue: enabled }; context.saveSettingsDebounced?.(); }
        apply(); onChange({ theme: 'moonlight_blue', enabled });
    });
    panel.content.append(label, note, preview, status); target.append(panel.drawer); apply();
    return () => { document.body.classList.remove('lunar-moonlight'); panel.drawer.remove(); };
}
