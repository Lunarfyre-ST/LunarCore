import { EFFECT_AREAS } from './areas.js';

export const PROFILE_DEFAULTS = Object.freeze({ moonlight: 82, twilight: 58, starlight: 72 });
export const PROFILE_NAMES = Object.freeze({ moonlight: 'Moonlight', twilight: 'Twilight', starlight: 'Starlight' });
export const TEXT_DEFAULTS = Object.freeze({
    moonlight: { body: '#ccd3df', emphasis: '#969fb4', quote: '#86c8ff' },
    twilight: { body: '#bcb8cc', emphasis: '#9290aa', quote: '#c5a0f0' },
    starlight: { body: '#a9afbd', emphasis: '#83899c', quote: '#9cb9df' },
});
const PREVIOUS_QUOTES = Object.freeze({ moonlight: '#a2b5cd', twilight: '#af9bc6', starlight: '#929eb5' });
const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const bounded = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function readUIPreferences(value = {}) {
    const customPresets = (Array.isArray(value?.customPresets) ? value.customPresets : []).slice(0, 8)
        .filter((preset, index, all) => typeof preset?.id === 'string' && /^custom-[1-8]$/.test(preset.id) && all.findIndex(other => other?.id === preset.id) === index && preset.config && typeof preset.config === 'object')
        .map(preset => ({ id: preset.id, name: presetName(preset.name), config: presetConfig({ ...preset.config, customPresets: [] }) }));
    return {
        customPresets,
        selectedPreset: customPresets.some(preset => preset.id === value?.selectedPreset) ? value.selectedPreset : '',
        enabled: typeof value?.enabled === 'boolean' ? value.enabled : value?.moonlightBlue === true,
        profile: typeof value?.profile === 'string' && Object.hasOwn(PROFILE_DEFAULTS, value.profile) ? value.profile : 'moonlight',
        textPaletteVersion: 2,
        opacity: {
            moonlight: bounded(value?.opacity?.moonlight, 20, 100, PROFILE_DEFAULTS.moonlight),
            twilight: bounded(value?.opacity?.twilight, 20, 100, PROFILE_DEFAULTS.twilight),
            starlight: bounded(value?.opacity?.starlight, 20, 100, PROFILE_DEFAULTS.starlight),
        },
        text: Object.fromEntries(Object.keys(PROFILE_DEFAULTS).map(profile => [profile, {
            enabled: typeof value?.text?.[profile]?.enabled === 'boolean' ? value.text[profile].enabled : true,
            ...Object.fromEntries(Object.entries(TEXT_DEFAULTS[profile]).map(([key, fallback]) => {
                const saved = color(value?.text?.[profile]?.[key], fallback);
                return [key, key === 'quote' && value?.textPaletteVersion !== 2 && saved === PREVIOUS_QUOTES[profile] ? fallback : saved];
            })),
        }])),
        effects: {
            enabled: value?.effects?.enabled === true,
            twinkles: typeof value?.effects?.twinkles === 'boolean' ? value.effects.twinkles : true,
            sweeps: typeof value?.effects?.sweeps === 'boolean' ? value.effects.sweeps : true,
            breathing: value?.effects?.breathing === true,
            randomPositions: value?.effects?.randomPositions === true,
            frequency: bounded(value?.effects?.frequency, 0.25, 2, bounded(value?.effects?.speed, 0.25, 2, 0.75)),
            intensity: bounded(value?.effects?.intensity, 0, 100, 35),
            speed: bounded(value?.effects?.speed, 0.25, 2, 0.75),
            areas: Object.fromEntries(EFFECT_AREAS.map(area => {
                const saved = value?.effects?.areas?.[area.id];
                return [area.id, {
                    enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : true,
                    twinkles: bounded(saved?.twinkles, 0, 100, area.twinkles),
                    sweeps: bounded(saved?.sweeps, 0, 100, area.id === 'settings' ? 100 : 50),
                    breathing: bounded(saved?.breathing, 0, 100, 60),
                    speed: bounded(saved?.speed, 0.25, 2, 1),
                    density: bounded(saved?.density, 0, 200, 100),
                }];
            })),
        },
    };
}

export function presetName(value) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) || 'Custom preset' : 'Custom preset';
}

export function presetConfig(value) {
    const safe = readUIPreferences({ ...value, customPresets: [], selectedPreset: '' });
    const { enabled, profile, opacity, text, textPaletteVersion, effects } = safe;
    return { enabled, profile, opacity, text, textPaletteVersion, effects };
}

export function parsePreset(text) {
    if (typeof text !== 'string' || text.length > 65536) throw new Error('invalid_preset');
    const value = JSON.parse(text);
    if (value?.kind !== 'lunar-ui-preset' || value?.version !== 1 || !value.config || typeof value.config !== 'object' || typeof value.config.profile !== 'string' || !Object.hasOwn(PROFILE_DEFAULTS, value.config.profile)) throw new Error('invalid_preset');
    return { name: presetName(value.name), config: presetConfig(value.config) };
}

export function saveUIPreferences(context, preferences) {
    const settings = context.extensionSettings || context.extension_settings;
    if (!settings) return;
    const safe = readUIPreferences(preferences);
    settings.LunarCore ||= {};
    // Retain the old boolean for the recorder's existing Moonlight-only contract.
    settings.LunarCore.ui = { ...safe, moonlightBlue: safe.enabled && safe.profile === 'moonlight' };
    context.saveSettingsDebounced?.();
}
