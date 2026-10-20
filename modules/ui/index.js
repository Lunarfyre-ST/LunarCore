import { createSettingsDrawer } from '../../core/settings-panel.js';
import { readUIPreferences, saveUIPreferences, PROFILE_DEFAULTS, PROFILE_NAMES, TEXT_DEFAULTS } from './preferences.js';
import { createNightEffects } from './effects.js';
import { EFFECT_AREAS } from './areas.js';

export function mountUI(target, context, { onChange = () => {} } = {}) {
    const panel = createSettingsDrawer('LunarUI', 'laptop', 'lunar-ui');
    const settings = context.extensionSettings || context.extension_settings;
    const preferences = readUIPreferences(settings?.LunarCore?.ui);
    let lastMoonlight = preferences.enabled && preferences.profile === 'moonlight';
    panel.content.innerHTML = `
        <label class="lunar-theme-toggle"><input type="checkbox" data-moonlight> Enable recoloring</label>
        <label class="lunar-ui-field">Night profile<select class="text_pole" data-ui-profile><option value="moonlight">Moonlight</option><option value="twilight">Twilight</option><option value="starlight">Starlight</option></select></label>
        <label class="lunar-ui-field">Panel opacity <input type="range" min="20" max="100" step="1" data-ui-opacity><output data-opacity-value></output></label>
        <p>Moonlight is a soft, muted blue. Twilight uses darker indigo and purple. Starlight has dim blue-gray accents, darker panels and calmer effects. Turn recoloring off to restore your current SillyTavern theme.</p>
        <fieldset class="lunar-effects-settings"><legend>Text colors for this preset</legend>
        <label class="lunar-theme-toggle"><input type="checkbox" data-text-enabled> Recolor text</label>
        ${['body', 'emphasis', 'quote'].map(key => `<label class="lunar-ui-field">${{ body: 'Regular text', emphasis: 'Emphasized text', quote: 'Quoted text' }[key]}<input type="color" data-text-${key}></label>`).join('')}
        <button type="button" class="menu_button" data-text-reset>Reset preset text colors</button>
        <p>Saved separately for each preset. Turn text recoloring off to use your native text colors.</p></fieldset>
        <div class="lunar-theme-preview" aria-hidden="true"><span class="lunar-preview-moon">☾</span><span data-profile-name></span><span class="lunar-preview-swatch"></span></div>
        <fieldset class="lunar-effects-settings"><legend>Night effects</legend>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-effects> Enable idle effects</label>
        <div class="lunar-effects-options">
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-twinkles> Starlight twinkles</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-sweeps> Shining sweeps</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-breathing> Soft bloom</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-random> Random star positions (experimental)</label><p>New positions each twinkle cycle; star count and frequency stay the same. Enable Soft bloom to use the area bloom slider.</p>
        <label class="lunar-ui-field">Intensity <input type="range" min="0" max="100" step="1" data-ui-intensity><output data-intensity-value></output></label>
        <label class="lunar-ui-field">Speed <input type="range" min="0.25" max="2" step="0.05" data-ui-speed><output data-speed-value></output></label>
        </div>
        <fieldset class="lunar-effects-settings"><legend>Area tuning</legend>
        <label class="lunar-ui-field">Area<select class="text_pole" data-ui-area>${EFFECT_AREAS.map(area => `<option value="${area.id}">${area.label}</option>`).join('')}</select></label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-area-enabled> Enable effects in this area</label>
        ${['twinkles', 'sweeps', 'breathing', 'speed'].map(key => `<label class="lunar-ui-field">${{ twinkles: 'Twinkle strength', sweeps: 'Sweep strength', breathing: 'Bloom strength', speed: 'Speed multiplier' }[key]}<input type="range" min="${key === 'speed' ? '0.25' : '0'}" max="${key === 'speed' ? '2' : '100'}" step="${key === 'speed' ? '0.05' : '1'}" data-area-${key}><output data-area-${key}-value></output></label>`).join('')}
        <p>Area strengths multiply the global intensity; zero disables that effect here. Area speed multiplies global speed. Chat / Sheld starts with gentler twinkles.</p></fieldset>
        <p>Effects decorate the chat window, composer, navigation, panels, dialogs and settings headers. They pause offscreen or in hidden tabs and honor reduced motion.</p>
        </fieldset><small data-ui-status role="status"></small>`;
    target.append(panel.drawer);
    const query = selector => panel.content.querySelector(selector);
    query('[data-moonlight]').checked = preferences.enabled;
    query('[data-ui-profile]').value = preferences.profile;
    query('[data-ui-effects]').checked = preferences.effects.enabled;
    for (const key of ['twinkles', 'sweeps', 'breathing']) query(`[data-ui-${key}]`).checked = preferences.effects[key];
    query('[data-ui-intensity]').value = preferences.effects.intensity;
    query('[data-ui-speed]').value = preferences.effects.speed;
    query('[data-ui-random]').checked = preferences.effects.randomPositions;
    function showArea() {
        const area = preferences.effects.areas[query('[data-ui-area]').value];
        query('[data-area-enabled]').checked = area.enabled;
        query('[data-area-enabled]').disabled = !preferences.effects.enabled;
        for (const key of ['twinkles', 'sweeps', 'breathing', 'speed']) {
            query(`[data-area-${key}]`).value = area[key];
            query(`[data-area-${key}]`).disabled = !preferences.effects.enabled || !area.enabled || (key === 'breathing' && !preferences.effects.breathing);
            query(`[data-area-${key}-value]`).textContent = key === 'speed' ? `${area[key].toFixed(2)}×` : `${area[key]}%`;
        }
    }
    let effectState = { active: false, reducedMotion: false, hidden: false };
    function status() {
        const name = PROFILE_NAMES[preferences.profile];
        const effects = !preferences.effects.enabled ? 'Idle effects are off.' : effectState.reducedMotion ? 'Idle effects paused: reduced motion.' : effectState.hidden ? 'Idle effects paused: tab hidden.' : 'Idle effects are enabled.';
        query('[data-ui-status]').textContent = `${preferences.enabled ? `${name} is active.` : 'Your SillyTavern theme is active.'} ${effects}`;
    }
    const effects = createNightEffects({ onStateChange(value) { effectState = value; status(); } });
    function apply() {
        const { profile, opacity } = preferences;
        document.body.classList.toggle('lunar-moonlight', preferences.enabled && profile === 'moonlight');
        document.body.classList.toggle('lunar-twilight', preferences.enabled && profile === 'twilight');
        document.body.classList.toggle('lunar-starlight', preferences.enabled && profile === 'starlight');
        document.body.classList.toggle('lunar-recolor', preferences.enabled);
        const text = preferences.text[profile];
        document.body.classList.toggle('lunar-text-recolor', preferences.enabled && text.enabled);
        query('[data-text-enabled]').checked = text.enabled;
        for (const key of ['body', 'emphasis', 'quote']) {
            query(`[data-text-${key}]`).value = text[key];
            query(`[data-text-${key}]`).disabled = !text.enabled;
            if (preferences.enabled && text.enabled) document.body.style.setProperty(`--lunar-text-${key}`, text[key]);
            else document.body.style.removeProperty(`--lunar-text-${key}`);
        }
        if (preferences.enabled) document.body.style.setProperty('--lunar-panel-opacity', String(opacity[profile] / 100));
        else document.body.style.removeProperty('--lunar-panel-opacity');
        panel.drawer.dataset.profile = profile;
        query('[data-ui-opacity]').value = opacity[profile];
        query('[data-opacity-value]').textContent = `${opacity[profile]}%`;
        query('[data-profile-name]').textContent = PROFILE_NAMES[profile];
        query('[data-intensity-value]').textContent = `${preferences.effects.intensity}%`;
        query('[data-speed-value]').textContent = `${preferences.effects.speed.toFixed(2)}×`;
        for (const input of panel.content.querySelectorAll('.lunar-effects-options input')) input.disabled = !preferences.effects.enabled;
        showArea(); effects.update({ ...preferences.effects, calm: preferences.enabled && profile === 'starlight' }); status();
    }
    function persist() {
        saveUIPreferences(context, preferences); apply();
        const activeMoonlight = preferences.enabled && preferences.profile === 'moonlight';
        // Do not extend the recorder owner's Moonlight-only preset contract here.
        if (activeMoonlight !== lastMoonlight) onChange({ theme: 'moonlight_blue', enabled: activeMoonlight });
        lastMoonlight = activeMoonlight;
    }
    query('[data-text-enabled]').addEventListener('change', event => { preferences.text[preferences.profile].enabled = event.target.checked; persist(); });
    for (const key of ['body', 'emphasis', 'quote']) query(`[data-text-${key}]`).addEventListener('input', event => { preferences.text[preferences.profile][key] = event.target.value; persist(); });
    query('[data-text-reset]').addEventListener('click', () => { preferences.text[preferences.profile] = { enabled: true, ...TEXT_DEFAULTS[preferences.profile] }; persist(); });
    query('[data-ui-random]').addEventListener('change', event => { preferences.effects.randomPositions = event.target.checked; persist(); });
    query('[data-moonlight]').addEventListener('change', event => { preferences.enabled = event.target.checked; persist(); });
    query('[data-ui-profile]').addEventListener('change', event => { preferences.profile = event.target.value; persist(); });
    for (const [key, selector] of [['enabled', 'effects'], ['twinkles', 'twinkles'], ['sweeps', 'sweeps'], ['breathing', 'breathing']]) {
        query(`[data-ui-${selector}]`).addEventListener('change', event => { preferences.effects[key] = event.target.checked; persist(); });
    }
    query('[data-ui-opacity]').addEventListener('input', event => { preferences.opacity[preferences.profile] = Number(event.target.value); persist(); });
    for (const key of ['intensity', 'speed']) query(`[data-ui-${key}]`).addEventListener('input', event => { preferences.effects[key] = Number(event.target.value); persist(); });
    query('[data-ui-area]').addEventListener('change', showArea);
    query('[data-area-enabled]').addEventListener('change', event => { preferences.effects.areas[query('[data-ui-area]').value].enabled = event.target.checked; persist(); });
    for (const key of ['twinkles', 'sweeps', 'breathing', 'speed']) query(`[data-area-${key}]`).addEventListener('input', event => {
        preferences.effects.areas[query('[data-ui-area]').value][key] = Number(event.target.value); persist();
    });
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'menu_button'; reset.textContent = 'Reset profile opacity';
    reset.addEventListener('click', () => { preferences.opacity[preferences.profile] = PROFILE_DEFAULTS[preferences.profile]; persist(); });
    query('[data-ui-opacity]').closest('label').after(reset);
    apply();
    return () => {
        effects.dispose(); document.body.classList.remove('lunar-moonlight', 'lunar-twilight', 'lunar-starlight', 'lunar-text-recolor', 'lunar-recolor');
        for (const key of ['body', 'emphasis', 'quote']) document.body.style.removeProperty(`--lunar-text-${key}`);
        document.body.style.removeProperty('--lunar-panel-opacity'); panel.drawer.remove();
    };
}
