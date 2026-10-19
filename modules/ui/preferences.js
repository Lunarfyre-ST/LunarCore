export const PROFILE_DEFAULTS = Object.freeze({ moonlight: 82, twilight: 58 });
const bounded = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function readUIPreferences(value = {}) {
    return {
        enabled: typeof value?.enabled === 'boolean' ? value.enabled : value?.moonlightBlue === true,
        profile: value?.profile === 'twilight' ? 'twilight' : 'moonlight',
        opacity: {
            moonlight: bounded(value?.opacity?.moonlight, 20, 100, PROFILE_DEFAULTS.moonlight),
            twilight: bounded(value?.opacity?.twilight, 20, 100, PROFILE_DEFAULTS.twilight),
        },
        effects: {
            enabled: value?.effects?.enabled === true,
            twinkles: typeof value?.effects?.twinkles === 'boolean' ? value.effects.twinkles : true,
            sweeps: typeof value?.effects?.sweeps === 'boolean' ? value.effects.sweeps : true,
            breathing: value?.effects?.breathing === true,
            intensity: bounded(value?.effects?.intensity, 0, 100, 35),
            speed: bounded(value?.effects?.speed, 0.25, 2, 0.75),
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
