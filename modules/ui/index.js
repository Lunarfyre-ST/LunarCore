import { createSettingsDrawer } from '../../core/settings-panel.js';
import { readUIPreferences, saveUIPreferences, PROFILE_DEFAULTS, PROFILE_NAMES, TEXT_DEFAULTS, presetConfig, presetName, parsePreset } from './preferences.js';
import { createNightEffects } from './effects.js';
import { EFFECT_AREAS } from './areas.js';

export function mountUI(target, context, { onChange = () => {} } = {}) {
    const panel = createSettingsDrawer('LunarUI', 'laptop', 'lunar-ui');
    const settings = context.extensionSettings || context.extension_settings;
    const preferences = readUIPreferences(settings?.LunarCore?.ui);
    let disposed = false;
    let lastMoonlight = preferences.enabled && preferences.profile === 'moonlight';
    panel.content.innerHTML = `
        <button type="button" class="menu_button" data-ui-disable-all>Disable all LunarUI styling and effects</button>
        <label class="lunar-theme-toggle"><input type="checkbox" data-moonlight> Enable recoloring</label>
        <label class="lunar-ui-field">Night profile<select class="text_pole" data-ui-profile><option value="moonlight">Moonlight</option><option value="twilight">Twilight</option><option value="starlight">Starlight</option></select></label>
        <details class="lunar-preset-tools"><summary>Save or share a custom preset</summary>
        <label class="lunar-ui-field">Preset name<input class="text_pole" type="text" maxlength="40" data-preset-name placeholder="My night preset"></label>
        <div class="lunar-ui-actions"><button type="button" class="menu_button" data-preset-save>Save preset</button><button type="button" class="menu_button" data-preset-delete>Delete saved preset</button><button type="button" class="menu_button" data-preset-export>Export appearance</button><button type="button" class="menu_button" data-preset-import>Import preset</button></div>
        <input type="file" accept=".json,application/json" data-preset-file hidden>
        <p>Up to eight custom presets, including colors and all effect/area controls. Exports contain the appearance settings and your chosen preset name.</p><small role="status" data-preset-status></small></details>
        <button type="button" class="menu_button" data-preset-reset>Reset this preset</button>
        <label class="lunar-ui-field">Panel opacity <input type="range" min="20" max="100" step="1" data-ui-opacity><output data-opacity-value></output></label>
        <p>Moonlight is a soft, muted blue. Twilight uses darker indigo and purple. Starlight has dim blue-gray accents, darker panels and calmer effects. Turn recoloring off to restore your current SillyTavern theme.</p>
        <fieldset class="lunar-effects-settings"><legend>Text colors for this preset</legend>
        <label class="lunar-theme-toggle"><input type="checkbox" data-text-enabled> Recolor text</label>
        ${['body', 'emphasis', 'quote'].map(key => `<label class="lunar-ui-field">${{ body: 'Regular text', emphasis: 'Emphasized text', quote: 'Quoted text' }[key]}<input type="color" data-text-${key}></label>`).join('')}
        <button type="button" class="menu_button" data-text-reset>Reset preset text colors</button>
        <p>Saved separately for each preset. Turn text recoloring off to use your native text colors.</p></fieldset>
        <div class="lunar-theme-preview" aria-hidden="true"><span class="lunar-preview-moon">☾</span><span data-profile-name></span><span class="lunar-preview-swatch"></span></div>
        <div class="lunar-text-preview" aria-label="Text color preview"><p>Regular text preview.</p><p><em>An action or emphasized passage.</em></p><p><q>Quoted dialogue stands apart.</q></p></div>
        <fieldset class="lunar-effects-settings"><legend>Night effects</legend>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-effects> Enable idle effects</label>
        <div class="lunar-effects-options">
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-twinkles> Starlight twinkles</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-sweeps> Shining sweeps</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-breathing> Soft bloom</label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-ui-random> Random star positions (experimental)</label><p>New positions each twinkle cycle; star count and frequency stay the same. Enable Soft bloom to use the area bloom slider.</p>
        <label class="lunar-ui-field">Intensity <input type="range" min="0" max="100" step="1" data-ui-intensity><output data-intensity-value></output></label>
        <label class="lunar-ui-field">Twinkle frequency <input type="range" min="0.25" max="2" step="0.05" data-ui-frequency><output data-frequency-value></output></label>
        <label class="lunar-ui-field">Sweep / bloom speed <input type="range" min="0.25" max="2" step="0.05" data-ui-speed><output data-speed-value></output></label>
        </div>
        <details data-area-settings><summary>Area tuning · advanced</summary><fieldset class="lunar-effects-settings"><legend>Adjust selected area</legend>
        <label class="lunar-ui-field">Area<select class="text_pole" data-ui-area>${EFFECT_AREAS.map(area => `<option value="${area.id}">${area.label}</option>`).join('')}</select></label>
        <label class="lunar-theme-toggle"><input type="checkbox" data-area-enabled> Enable effects in this area</label>
        ${['twinkles', 'sweeps', 'breathing', 'speed', 'density'].map(key => `<label class="lunar-ui-field">${{ twinkles: 'Twinkle strength', sweeps: 'Sweep strength', breathing: 'Bloom strength', speed: 'Speed multiplier', density: 'Star density' }[key]}<input type="range" min="${key === 'speed' ? '0.25' : '0'}" max="${key === 'speed' ? '2' : key === 'density' ? '200' : '100'}" step="${key === 'speed' ? '0.05' : '1'}" data-area-${key}><output data-area-${key}-value></output></label>`).join('')}
        <button type="button" class="menu_button" data-area-reset>Reset this area</button>
        <p>Strengths multiply global intensity; zero disables that effect here. Density changes the number of stars. Area speed multiplies each effect's pace.</p></fieldset></details>
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
    query('[data-ui-frequency]').value = preferences.effects.frequency;
    query('[data-ui-random]').checked = preferences.effects.randomPositions;
    function showArea() {
        const area = preferences.effects.areas[query('[data-ui-area]').value];
        query('[data-area-enabled]').checked = area.enabled;
        query('[data-area-enabled]').disabled = !preferences.effects.enabled;
        for (const key of ['twinkles', 'sweeps', 'breathing', 'speed', 'density']) {
            query(`[data-area-${key}]`).value = area[key];
            query(`[data-area-${key}]`).disabled = !preferences.effects.enabled || !area.enabled || (key === 'breathing' && !preferences.effects.breathing);
            query(`[data-area-${key}-value]`).textContent = key === 'speed' ? `${area[key].toFixed(2)}×` : `${area[key]}%`;
        }
    }
    let effectState = { active: false, reducedMotion: false, hidden: false };
    function status() {
        const custom = preferences.customPresets.find(preset => preset.id === preferences.selectedPreset);
        const modified = custom && JSON.stringify(presetConfig(preferences)) !== JSON.stringify(custom.config);
        const name = custom ? `${custom.name}${modified ? ' (modified)' : ''}` : PROFILE_NAMES[preferences.profile];
        const effects = !preferences.effects.enabled ? 'Idle effects are off.' : effectState.reducedMotion ? 'Idle effects paused: reduced motion.' : effectState.hidden ? 'Idle effects paused: tab hidden.' : 'Idle effects are enabled.';
        query('[data-ui-status]').textContent = `${preferences.enabled ? `${name} is active.` : 'Your SillyTavern theme is active.'} ${effects}`;
    }
    const effects = createNightEffects({ onStateChange(value) { effectState = value; status(); } });
    function apply() {
        const { profile, opacity } = preferences;
        for (const option of panel.content.querySelectorAll('option[data-custom]')) option.remove();
        for (const preset of preferences.customPresets) {
            const option = document.createElement('option'); option.value = preset.id; option.textContent = preset.name; option.dataset.custom = ''; query('[data-ui-profile]').append(option);
        }
        query('[data-ui-profile]').value = preferences.selectedPreset || profile;
        query('[data-preset-delete]').disabled = !preferences.selectedPreset;
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
            panel.drawer.style.setProperty(`--lunar-preview-${key}`, text.enabled ? text[key] : `var(--SmartTheme${{ body: 'BodyColor', emphasis: 'EmColor', quote: 'QuoteColor' }[key]})`);
        }
        if (preferences.enabled) document.body.style.setProperty('--lunar-panel-opacity', String(opacity[profile] / 100));
        else document.body.style.removeProperty('--lunar-panel-opacity');
        panel.drawer.dataset.profile = profile;
        query('[data-ui-opacity]').value = opacity[profile];
        query('[data-opacity-value]').textContent = `${opacity[profile]}%`;
        query('[data-profile-name]').textContent = PROFILE_NAMES[profile];
        query('[data-intensity-value]').textContent = `${preferences.effects.intensity}%`;
        query('[data-speed-value]').textContent = `${preferences.effects.speed.toFixed(2)}×`;
        query('[data-frequency-value]').textContent = `${preferences.effects.frequency.toFixed(2)}×`;
        query('[data-ui-frequency]').value = preferences.effects.frequency;
        query('[data-ui-speed]').value = preferences.effects.speed;
        query('[data-ui-intensity]').value = preferences.effects.intensity;
        query('[data-ui-effects]').checked = preferences.effects.enabled;
        query('[data-ui-random]').checked = preferences.effects.randomPositions;
        query('[data-moonlight]').checked = preferences.enabled;
        for (const key of ['twinkles', 'sweeps', 'breathing']) query(`[data-ui-${key}]`).checked = preferences.effects[key];
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
    query('[data-ui-profile]').addEventListener('change', event => {
        const custom = preferences.customPresets.find(preset => preset.id === event.target.value);
        if (custom) { Object.assign(preferences, presetConfig(custom.config)); preferences.selectedPreset = custom.id; query('[data-preset-name]').value = custom.name; }
        else { preferences.profile = event.target.value; preferences.selectedPreset = ''; }
        persist();
    });
    for (const [key, selector] of [['enabled', 'effects'], ['twinkles', 'twinkles'], ['sweeps', 'sweeps'], ['breathing', 'breathing']]) {
        query(`[data-ui-${selector}]`).addEventListener('change', event => { preferences.effects[key] = event.target.checked; persist(); });
    }
    query('[data-ui-opacity]').addEventListener('input', event => { preferences.opacity[preferences.profile] = Number(event.target.value); persist(); });
    for (const key of ['intensity', 'speed', 'frequency']) query(`[data-ui-${key}]`).addEventListener('input', event => { preferences.effects[key] = Number(event.target.value); persist(); });
    query('[data-ui-area]').addEventListener('change', showArea);
    query('[data-area-enabled]').addEventListener('change', event => { preferences.effects.areas[query('[data-ui-area]').value].enabled = event.target.checked; persist(); });
    for (const key of ['twinkles', 'sweeps', 'breathing', 'speed', 'density']) query(`[data-area-${key}]`).addEventListener('input', event => {
        preferences.effects.areas[query('[data-ui-area]').value][key] = Number(event.target.value); persist();
    });
    query('[data-area-reset]').addEventListener('click', () => { const id = query('[data-ui-area]').value; preferences.effects.areas[id] = readUIPreferences().effects.areas[id]; persist(); });
    query('[data-ui-disable-all]').addEventListener('click', () => { preferences.enabled = false; preferences.effects.enabled = false; persist(); });
    query('[data-preset-reset]').addEventListener('click', () => {
        const custom = preferences.customPresets.find(preset => preset.id === preferences.selectedPreset);
        if (custom) Object.assign(preferences, presetConfig(custom.config));
        else { preferences.opacity[preferences.profile] = PROFILE_DEFAULTS[preferences.profile]; preferences.text[preferences.profile] = { enabled: true, ...TEXT_DEFAULTS[preferences.profile] }; preferences.effects = readUIPreferences().effects; }
        persist();
    });
    function saveCustom(name, config, update = false) {
        const current = update ? preferences.customPresets.find(preset => preset.id === preferences.selectedPreset && preset.name === name) : null;
        const id = current?.id || Array.from({ length: 8 }, (_, index) => `custom-${index + 1}`).find(key => !preferences.customPresets.some(preset => preset.id === key));
        if (!id) { query('[data-preset-status]').textContent = 'Eight presets are saved. Delete one before adding another.'; return; }
        const preset = { id, name: presetName(name), config: presetConfig(config) };
        if (current) Object.assign(current, preset); else preferences.customPresets.push(preset);
        Object.assign(preferences, presetConfig(config)); preferences.selectedPreset = id; query('[data-preset-name]').value = preset.name;
        persist(); query('[data-preset-status]').textContent = 'Preset saved.';
    }
    query('[data-preset-save]').addEventListener('click', () => saveCustom(query('[data-preset-name]').value, preferences, true));
    query('[data-preset-delete]').addEventListener('click', () => { preferences.customPresets = preferences.customPresets.filter(preset => preset.id !== preferences.selectedPreset); preferences.selectedPreset = ''; persist(); query('[data-preset-status]').textContent = 'Saved preset deleted. Current appearance retained.'; });
    query('[data-preset-export]').addEventListener('click', () => {
        const value = { kind: 'lunar-ui-preset', version: 1, name: presetName(query('[data-preset-name]').value || PROFILE_NAMES[preferences.profile]), config: presetConfig(preferences) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'lunar-ui-preset.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    query('[data-preset-import]').addEventListener('click', () => query('[data-preset-file]').click());
    query('[data-preset-file]').addEventListener('change', async event => {
        try {
            const file = event.target.files?.[0]; if (!file) return;
            if (file.size > 65536) throw new Error('invalid_preset');
            const preset = parsePreset(await file.text()); if (!disposed) saveCustom(preset.name, preset.config);
        } catch { if (!disposed) query('[data-preset-status]').textContent = 'Could not import this preset. Use a LunarUI preset JSON file under 64 KB.'; }
        finally { event.target.value = ''; }
    });
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'menu_button'; reset.textContent = 'Reset profile opacity';
    reset.addEventListener('click', () => { preferences.opacity[preferences.profile] = PROFILE_DEFAULTS[preferences.profile]; persist(); });
    query('[data-ui-opacity]').closest('label').after(reset);
    apply();
    return () => {
        disposed = true;
        effects.dispose(); document.body.classList.remove('lunar-moonlight', 'lunar-twilight', 'lunar-starlight', 'lunar-text-recolor', 'lunar-recolor');
        for (const key of ['body', 'emphasis', 'quote']) document.body.style.removeProperty(`--lunar-text-${key}`);
        document.body.style.removeProperty('--lunar-panel-opacity'); panel.drawer.remove();
    };
}
