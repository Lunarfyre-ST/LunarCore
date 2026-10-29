import { createRecorder } from './core/diagnostics.js';
import { mountDebug } from './modules/debug/index.js';
import { readDebugPreferences } from './core/debug-preferences.js';
import { mountSettingsPanel } from './core/settings-panel.js';
import { mountUI } from './modules/ui/index.js';
import { mountSummary } from './modules/summary/index.js';

const runtimeKey = Symbol.for('LunarCore.runtime');
const sinkKey = Symbol.for('LunarDebug.sink');
if (!globalThis[runtimeKey]) {
    const runtime = { dispose: null };
    globalThis[runtimeKey] = runtime;
    const initialize = () => {
        const target = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
        if (!target || typeof globalThis.SillyTavern?.getContext !== 'function') return;
        const context = globalThis.SillyTavern.getContext();
        const recorder = createRecorder({ capacity: readDebugPreferences(context).capacity });
        globalThis[sinkKey] = recorder.api;
        const panel = mountSettingsPanel(target);
        const unmountUI = mountUI(panel.content, context, { onChange: fields => recorder.api.emit('ui.theme', fields) });
        const unmountSummary = mountSummary(panel.content, () => globalThis.SillyTavern.getContext());
        const unmountDebug = mountDebug(recorder, context, panel.content, { onStatus: panel.updateStatus });
        runtime.dispose = () => { unmountDebug(); unmountSummary(); unmountUI(); panel.dispose(); if (globalThis[sinkKey] === recorder.api) delete globalThis[sinkKey]; delete globalThis[runtimeKey]; };
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}
