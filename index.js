import { createRecorder } from './core/diagnostics.js';
import { mountDebug } from './modules/debug/index.js';

const runtimeKey = Symbol.for('LunarCore.runtime');
const sinkKey = Symbol.for('LunarDebug.sink');
if (!globalThis[runtimeKey]) {
    const runtime = { dispose: null };
    globalThis[runtimeKey] = runtime;
    const initialize = () => {
        const target = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
        if (!target || typeof globalThis.SillyTavern?.getContext !== 'function') return;
        const recorder = createRecorder();
        globalThis[sinkKey] = recorder.api;
        const unmount = mountDebug(recorder, globalThis.SillyTavern.getContext(), target);
        runtime.dispose = () => { unmount(); if (globalThis[sinkKey] === recorder.api) delete globalThis[sinkKey]; delete globalThis[runtimeKey]; };
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}
