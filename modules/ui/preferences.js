import { EFFECT_AREAS } from './areas.js';

export const PROFILE_DEFAULTS = Object.freeze({ moonlight: 82, twilight: 58, starlight: 72 });
export const PROFILE_NAMES = Object.freeze({ moonlight: 'Moonlight', twilight: 'Twilight', starlight: 'Starlight' });
export const TEXT_DEFAULTS = Object.freeze({
    moonlight: { body: '#ccd3df', emphasis: '#969fb4', quote: '#a2b5cd' },
    twilight: { body: '#bcb8cc', emphasis: '#9290aa', quote: '#af9bc6' },
    starlight: { body: '#a9afbd', emphasis: '#83899c', quote: '#929eb5' },
});
const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const bounded = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function readUIPreferences(value = {}) {
    return {
        enabled: typeof value?.enabled === 'boolean' ? value.enabled : value?.moonlightBlue === true,
        profile: Object.hasOwn(PROFILE_DEFAULTS, value?.profile) ? value.profile : 'moonlight',
        opacity: {
            moonlight: bounded(value?.opacity?.moonlight, 20, 100, PROFILE_DEFAULTS.moonlight),
            twilight: bounded(value?.opacity?.twilight, 20, 100, PROFILE_DEFAULTS.twilight),
            starlight: bounded(value?.opacity?.starlight, 20, 100, PROFILE_DEFAULTS.starlight),
        },
        text: Object.fromEntries(Object.keys(PROFILE_DEFAULTS).map(profile => [profile, {
            enabled: typeof value?.text?.[profile]?.enabled === 'boolean' ? value.text[profile].enabled : true,
            ...Object.fromEntries(Object.entries(TEXT_DEFAULTS[profile]).map(([key, fallback]) => [key, color(value?.text?.[profile]?.[key], fallback)])),
        }])),
        effects: {
            enabled: value?.effects?.enabled === true,
            twinkles: typeof value?.effects?.twinkles === 'boolean' ? value.effects.twinkles : true,
            sweeps: typeof value?.effects?.sweeps === 'boolean' ? value.effects.sweeps : true,
            breathing: value?.effects?.breathing === true,
            randomPositions: value?.effects?.randomPositions === true,
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
                }];
            })),
        },
    };
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
