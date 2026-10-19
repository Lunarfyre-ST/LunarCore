import { createSettingsDrawer } from '../../core/settings-panel.js';
import { readUIPreferences, saveUIPreferences, PROFILE_DEFAULTS } from './preferences.js';
import { createNightEffects } from './effects.js';

export function mountUI(target, context, { onChange = () => {} } = {}) {
    const panel = createSettingsDrawer('LunarUI', 'laptop', 'lunar-ui');
    const settings = context.extensionSettings || context.extension_settings;
    const preferences = readUIPreferences(settings?.LunarCore?.ui);
    let lastMoonlight = preferences.enabled && preferences.profile === 'moonlight';
    panel.content.innerHTML = `
        <label class="lunar-theme-toggle"><input type="checkbox" data-moonlight> Enable recoloring</label>
        <label class="lunar-ui-field">Night profile<select class="text_pole" data-ui-profile><option value="moonlight">Moonlight Blue</option><option value="twilight">Twilight</option></select></label>
        <label class="lunar-ui-field">Panel opacity <input type="range" min="20" max="100" step="1" data-ui-opacity><output data-opacity-value></output></label>
        <p>Moonlight Blue is a soft, muted blue. Twilight uses darker indigo and purple with more transparency. Turn recoloring off to restore your current SillyTavern theme.</p>
        <div class="lunar-theme-preview" aria-hidden="true"><span class="lunar-preview-moon">☾</span><span data-profile-name></span><span class="lunar-preview-swatch"></span></div>
        <fieldset class="lunar-effects-settings"><legend>Night effects</legend>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-effects> Enable idle effects</label>
        <div class="lunar-effects-options">
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-twinkles> Starlight twinkles</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-sweeps> Shining sweeps</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-breathing> Breathing glow</label>
        <label class="lunar-ui-field">Intensity <input type="range" min="0" max="100" step="1" data-ui-intensity><output data-intensity-value></output></label>
        <label class="lunar-ui-field">Speed <input type="range" min="0.25" max="2" step="0.05" data-ui-speed><output data-speed-value></output></label>
        </div><p>Decorative effects stay on settings headers. They pause in hidden tabs and honor reduced motion.</p>
        </fieldset><small data-ui-status role="status"></small>`;
    target.append(panel.drawer);
    const query = selector => panel.content.querySelector(selector);
    query('[data-moonlight]').checked = preferences.enabled;
    query('[data-ui-profile]').value = preferences.profile;
    query('[data-ui-effects]').checked = preferences.effects.enabled;
    for (const key of ['twinkles', 'sweeps', 'breathing']) query(`[data-ui-${key}]`).checked = preferences.effects[key];
    query('[data-ui-intensity]').value = preferences.effects.intensity;
    query('[data-ui-speed]').value = preferences.effects.speed;
    let effectState = { active: false, reducedMotion: false, hidden: false };
    function status() {
        const name = preferences.profile === 'twilight' ? 'Twilight' : 'Moonlight Blue';
        const effects = !preferences.effects.enabled ? 'Idle effects are off.' : effectState.reducedMotion ? 'Idle effects paused: reduced motion.' : effectState.hidden ? 'Idle effects paused: tab hidden.' : 'Idle effects are enabled.';
        query('[data-ui-status]').textContent = `${preferences.enabled ? `${name} is active.` : 'Your SillyTavern theme is active.'} ${effects}`;
    }
    const effects = createNightEffects({ onStateChange(value) { effectState = value; status(); } });
    function apply() {
        const { profile, opacity } = preferences;
        document.body.classList.toggle('lunar-moonlight', preferences.enabled && profile === 'moonlight');
        document.body.classList.toggle('lunar-twilight', preferences.enabled && profile === 'twilight');
        document.body.classList.toggle('lunar-recolor', preferences.enabled);
        if (preferences.enabled) document.body.style.setProperty('--lunar-panel-opacity', String(opacity[profile] / 100));
        else document.body.style.removeProperty('--lunar-panel-opacity');
        panel.drawer.dataset.profile = profile;
        query('[data-ui-opacity]').value = opacity[profile];
        query('[data-opacity-value]').textContent = `${opacity[profile]}%`;
        query('[data-profile-name]').textContent = profile === 'twilight' ? 'Twilight' : 'Moonlight Blue';
        query('[data-intensity-value]').textContent = `${preferences.effects.intensity}%`;
        query('[data-speed-value]').textContent = `${preferences.effects.speed.toFixed(2)}×`;
        for (const input of panel.content.querySelectorAll('.lunar-effects-options input')) input.disabled = !preferences.effects.enabled;
        effects.update(preferences.effects); status();
    }
    function persist() {
        saveUIPreferences(context, preferences); apply();
        const activeMoonlight = preferences.enabled && preferences.profile === 'moonlight';
        // Do not extend the recorder owner's Moonlight-only preset contract here.
        if (activeMoonlight !== lastMoonlight) onChange({ theme: 'moonlight_blue', enabled: activeMoonlight });
        lastMoonlight = activeMoonlight;
    }
    query('[data-moonlight]').addEventListener('change', event => { preferences.enabled = event.target.checked; persist(); });
    query('[data-ui-profile]').addEventListener('change', event => { preferences.profile = event.target.value; persist(); });
    for (const [key, selector] of [['enabled', 'effects'], ['twinkles', 'twinkles'], ['sweeps', 'sweeps'], ['breathing', 'breathing']]) {
        query(`[data-ui-${selector}]`).addEventListener('change', event => { preferences.effects[key] = event.target.checked; persist(); });
    }
    query('[data-ui-opacity]').addEventListener('input', event => { preferences.opacity[preferences.profile] = Number(event.target.value); persist(); });
    for (const key of ['intensity', 'speed']) query(`[data-ui-${key}]`).addEventListener('input', event => { preferences.effects[key] = Number(event.target.value); persist(); });
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'menu_button'; reset.textContent = 'Reset profile opacity';
    reset.addEventListener('click', () => { preferences.opacity[preferences.profile] = PROFILE_DEFAULTS[preferences.profile]; persist(); });
    query('[data-ui-opacity]').closest('label').after(reset);
    apply();
    return () => {
        effects.dispose(); document.body.classList.remove('lunar-moonlight', 'lunar-twilight', 'lunar-recolor');
        document.body.style.removeProperty('--lunar-panel-opacity'); panel.drawer.remove();
    };
}
