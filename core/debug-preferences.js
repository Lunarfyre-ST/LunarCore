export function readDebugPreferences(context) {
    const value = (context.extensionSettings || context.extension_settings)?.LunarCore?.debug;
    return {
        capacity: Number.isInteger(value?.capacity) && value.capacity >= 1000 && value.capacity <= 50000 ? value.capacity : 10000,
        autoStart: value?.autoStart === true,
        autoSave: value?.autoSave === true,
    };
}
export function saveDebugPreferences(context, value) {
    const settings = context.extensionSettings || context.extension_settings;
    if (!settings) return;
    settings.LunarCore ||= {};
    settings.LunarCore.debug = { capacity: value.capacity, autoStart: value.autoStart === true, autoSave: value.autoSave === true };
    context.saveSettingsDebounced?.();
}
