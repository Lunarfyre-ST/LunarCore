import test from 'node:test';
import assert from 'node:assert/strict';
import { readUIPreferences, saveUIPreferences, presetConfig, parsePreset } from '../modules/ui/preferences.js';

test('old Moonlight choices migrate without enabling motion or dropping explicit disable', () => {
    const legacy = readUIPreferences({ moonlightBlue: true });
    assert.equal(legacy.enabled, true); assert.equal(legacy.profile, 'moonlight');
    assert.equal(legacy.effects.enabled, false);
    assert.equal(legacy.opacity.twilight < legacy.opacity.moonlight, true);
    assert.equal(readUIPreferences({ enabled: false, moonlightBlue: true }).enabled, false);
    assert.equal(readUIPreferences(null).enabled, false);
    assert.equal(readUIPreferences().mobileScrollGuard, false);
    assert.equal(readUIPreferences({ mobileScrollGuard: true }).mobileScrollGuard, true);
    assert.equal(readUIPreferences({ mobileScrollGuard: 'true' }).mobileScrollGuard, false);
    assert.equal('mobileScrollGuard' in presetConfig({ mobileScrollGuard: true }), false);
});

test('settings are bounded, typed and independent for each profile', () => {
    const value = readUIPreferences({ profile: 'private text', opacity: { moonlight: -10, twilight: Infinity }, effects: { intensity: 200, speed: 0, enabled: 'true' } });
    assert.equal(value.profile, 'moonlight'); assert.equal(value.opacity.moonlight, 20);
    assert.equal(value.opacity.twilight, 58); assert.equal(value.effects.intensity, 100);
    assert.equal(value.effects.speed, 0.25); assert.equal(value.effects.enabled, false);
});

test('UI saves preserve recorder preferences and retain the legacy Moonlight flag accurately', () => {
    let saves = 0;
    const context = { extensionSettings: { LunarCore: { debug: { autoSave: true, capacity: 5000 } } }, saveSettingsDebounced() { saves++; } };
    saveUIPreferences(context, { enabled: true, profile: 'twilight', privateText: 'PRIVATE', opacity: { twilight: 46 }, effects: { enabled: true } });
    assert.deepEqual(context.extensionSettings.LunarCore.debug, { autoSave: true, capacity: 5000 });
    assert.equal(context.extensionSettings.LunarCore.ui.moonlightBlue, false);
    assert.equal(JSON.stringify(context.extensionSettings.LunarCore.ui).includes('PRIVATE'), false);
    assert.equal(readUIPreferences(context.extensionSettings.LunarCore.ui).opacity.twilight, 46);
    saveUIPreferences(context, { enabled: true, profile: 'moonlight' });
    assert.equal(context.extensionSettings.LunarCore.ui.moonlightBlue, true); assert.equal(saves, 2);
});

test('area controls migrate independently and reject unknown or untyped values', () => {
    const defaults = readUIPreferences({ effects: { enabled: true } }).effects;
    assert.equal(defaults.areas.chat.twinkles, 25);
    assert.equal(defaults.areas.settings.twinkles, 100);
    const prefs = readUIPreferences({ effects: { areas: {
        chat: { enabled: false, twinkles: 0, speed: 5 },
        settings: { enabled: 'false', sweeps: -1, breathing: Infinity },
        privateArea: { enabled: true },
    } } });
    assert.equal(prefs.effects.areas.chat.enabled, false);
    assert.equal(prefs.effects.areas.chat.twinkles, 0);
    assert.equal(prefs.effects.areas.chat.speed, 2);
    assert.equal(prefs.effects.areas.settings.enabled, true);
    assert.equal(prefs.effects.areas.settings.sweeps, 0);
    assert.equal(prefs.effects.areas.settings.breathing, 60);
    assert.equal('privateArea' in prefs.effects.areas, false);
    assert.deepEqual(readUIPreferences(prefs), prefs);
});

test('Starlight and per-preset text preferences are typed, independent and migration safe', () => {
    const prefs = readUIPreferences({ profile: 'starlight', text: {
        starlight: { enabled: false, body: '#ABCDEF', emphasis: 'url(private)', quote: '#123456' },
        moonlight: { body: '#fedcba' },
    }, effects: { randomPositions: 'true' } });
    assert.equal(prefs.profile, 'starlight');
    assert.equal(prefs.opacity.starlight, 72);
    assert.equal(prefs.text.starlight.body, '#abcdef');
    assert.equal(prefs.text.starlight.emphasis, '#83899c');
    assert.equal(prefs.text.starlight.enabled, false);
    assert.equal(prefs.text.moonlight.body, '#fedcba');
    assert.equal(prefs.text.twilight.body, '#bcb8cc');
    assert.equal(prefs.effects.randomPositions, false);
    assert.deepEqual(readUIPreferences(prefs), prefs);
});

test('strong quote defaults migrate previous defaults while preserving custom choices', () => {
    const value = readUIPreferences({ text: {
        moonlight: { quote: '#a2b5cd' }, twilight: { quote: '#ffbb44' }, starlight: { quote: '#929eb5' },
    } });
    assert.equal(value.text.moonlight.quote, '#86c8ff');
    assert.equal(value.text.twilight.quote, '#ffbb44');
    assert.equal(value.text.starlight.quote, '#9cb9df');
    assert.deepEqual(readUIPreferences(value), value);
    assert.equal(readUIPreferences({ textPaletteVersion: 2, text: { moonlight: { quote: '#a2b5cd' } } }).text.moonlight.quote, '#a2b5cd');
});

test('custom presets and imports are bounded, typed snapshots without recorder data', () => {
    assert.equal(readUIPreferences().effects.renderer, 'auto');
    assert.equal(readUIPreferences({ effects: { renderer: 'compatibility' } }).effects.renderer, 'compatibility');
    assert.equal(readUIPreferences({ effects: { renderer: 'PRIVATE' } }).effects.renderer, 'auto');
    const config = presetConfig({ enabled: true, profile: 'starlight', effects: { enabled: true, speed: 1.2, frequency: 4, areas: { chat: { density: 900 } } }, debug: { private: 'PRIVATE' }, unknown: 'PRIVATE' });
    assert.equal(config.effects.frequency, 2);
    assert.equal(config.effects.areas.chat.density, 200);
    assert.equal(JSON.stringify(config).includes('PRIVATE'), false);
    assert.equal(readUIPreferences({ effects: { speed: 0.4 } }).effects.frequency, 0.4);
    const customPresets = Array.from({ length: 12 }, (_, index) => ({ id: `custom-${index + 1}`, name: 'Long name'.repeat(10), config }));
    const value = readUIPreferences({ customPresets, selectedPreset: 'custom-1' });
    assert.equal(value.customPresets.length, 8);
    assert.equal(value.customPresets[0].name.length, 40);
    assert.equal(value.selectedPreset, 'custom-1');
    assert.deepEqual(readUIPreferences(value), value);
    assert.equal(readUIPreferences({ customPresets: [customPresets[0], customPresets[0]], selectedPreset: 'custom-2' }).customPresets.length, 1);
    assert.equal(readUIPreferences({ selectedPreset: 'custom-2' }).selectedPreset, '');
    const parsed = parsePreset(JSON.stringify({ kind: 'lunar-ui-preset', version: 1, name: '<My preset>', config }));
    assert.equal(parsed.name, '<My preset>');
    assert.deepEqual(parsed.config, config);
    for (const invalid of ['{}', 'not json', JSON.stringify({ kind: 'lunar-debug-recording', config }), ' '.repeat(65537)]) assert.throws(() => parsePreset(invalid));
});
