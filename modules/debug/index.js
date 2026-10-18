import { connectImmersiveGroups } from '../../integrations/immersivegroups.js';
import { readDebugPreferences, saveDebugPreferences } from '../../core/debug-preferences.js';
import { createSettingsDrawer } from '../../core/settings-panel.js';
import { VERSION } from '../../core/version.js';

export function mountDebug(recorder, context, target, { onStatus = () => {} } = {}) {
    const preferences = readDebugPreferences(context);
    const section = createSettingsDrawer('LunarDebug', 'butterfly', 'lunar-debug');
    const panel = section.drawer;
    const alert = document.createElement('span'); alert.dataset.alert = ''; section.label.append(alert);
    section.content.innerHTML = `
        <label><input type="checkbox" data-record> Record diagnostic metadata</label>
        <label>Maximum retained records <input type="number" min="1000" max="50000" step="1000" data-capacity></label>
        <label><input type="checkbox" data-auto-start> Start recording automatically after reload</label>
        <p>Repeated routine activity is summarized. The newest 200 attention records survive main-buffer rollover. Recordings stay in memory; only these preferences are saved. Setting names, configuration values and execution states are recorded. API keys, personal/character names, user input and model output are excluded.</p>
        <p data-status role="status"></p><p data-integration></p>
        <div class="lunar-debug-actions"><button type="button" class="menu_button" data-export>Export JSON</button><button type="button" class="menu_button" data-clear>Clear recording</button></div>
        <label>Event filter <select data-filter><option value="">All events</option><option value="attention">Attention records</option><option value="ui.">UI actions / scrolling</option><option value="ig.setting">Configuration</option><option value="outfit.">Outfits</option><option value="background.">Backgrounds</option><option value="animation.">Animations</option><option value="context.">Context injection</option><option value="automation.">Automation</option><option value="host.">SillyTavern</option><option value="ig.">IG changes</option></select></label>
        <pre data-events aria-label="Recent diagnostic events"></pre>`;
    target.append(panel);
    const query = selector => panel.querySelector(selector);
    let disconnect = null, lastSignature = '';
    function attach() { disconnect?.(); disconnect = connectImmersiveGroups(recorder.api, context); }
    function render() {
        const stats = recorder.stats();
        onStatus(stats);
        query('[data-status]').textContent = `${stats.active ? 'Recording' : 'Stopped'} · ${stats.count}/${stats.capacity} records · ${stats.dropped} oldest events discarded · ${stats.summarized} routine repeats summarized · ${stats.attentionCount} attention records · ${stats.cancelledCount} cancellations · ${stats.unobservedCount} generation completions not observed (not automatically errors)`;
        query('[data-alert]').textContent = stats.attentionCount ? `· ${stats.attentionCount} attention` : '';
        query('[data-alert]').classList.toggle('lunar-debug-warning', stats.attentionCount > 0);
        const ig = globalThis.ImmersiveGroups;
        query('[data-integration]').textContent = !ig ? 'ImmersiveGroups not detected.' : ig.diagnosticsProtocol === 1 ? 'ImmersiveGroups: detailed execution hooks available.' : 'Limited coverage: UI/configuration recording is available, but outfit, animation, automation and injection execution traces require the ImmersiveGroups copy with diagnostic hooks. Updating LunarCore alone does not enable those hooks.';
        query('[data-integration]').classList.toggle('lunar-debug-warning', Boolean(ig && ig.diagnosticsProtocol !== 1));
        query('[data-export]').disabled = stats.count === 0;
        const filter = query('[data-filter]').value, signature = `${stats.revision}:${stats.active}:${filter}`;
        if (signature === lastSignature) return;
        if (!query('[data-events]').getClientRects().length) return;
        lastSignature = signature;
        const rows = filter === 'attention' ? recorder.attentionEntries() : recorder.entries().filter(row => !filter || row.event.startsWith(filter));
        query('[data-events]').textContent = rows.slice(-60).map(row => JSON.stringify(row)).join('\n');
    }
    query('[data-record]').addEventListener('change', event => {
        if (event.target.checked) { recorder.start(); attach(); }
        else { disconnect?.(); disconnect = null; recorder.stop(); }
        render();
    });
    query('[data-clear]').addEventListener('click', () => { disconnect?.(true); disconnect = null; recorder.clear(); lastSignature = ''; if (recorder.stats().active) attach(); render(); });
    query('[data-filter]').addEventListener('change', render);
    query('[data-filter]').append(new Option('Generation lifecycle', 'generation.'));
    query('[data-capacity]').value = preferences.capacity;
    query('[data-capacity]').classList.add('text_pole');
    query('[data-capacity]').step = '1';
    query('[data-auto-start]').checked = preferences.autoStart;
    query('[data-capacity]').addEventListener('change', event => {
        const value = Number(event.target.value);
        if (!Number.isInteger(value) || value < 1000 || value > 50000) {
            event.target.setCustomValidity('Choose a whole number from 1,000 to 50,000.'); event.target.reportValidity(); return;
        }
        event.target.setCustomValidity(''); recorder.resize(value); preferences.capacity = value;
        saveDebugPreferences(context, preferences); render();
    });
    query('[data-capacity]').addEventListener('input', event => event.target.setCustomValidity(''));
    query('[data-auto-start]').addEventListener('change', event => { preferences.autoStart = event.target.checked; saveDebugPreferences(context, preferences); });
    query('[data-export]').addEventListener('click', () => {
        disconnect?.flush();
        const data = recorder.export({ lunarCore: VERSION, immersiveGroups: globalThis.ImmersiveGroups?.version });
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'lunar-debug-recording.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const timer = setInterval(render, 500);
    if (preferences.autoStart) { query('[data-record]').checked = true; recorder.start(); attach(); }
    render();
    return () => { disconnect?.(); recorder.stop(); clearInterval(timer); panel.remove(); };
}
