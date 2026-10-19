import { connectImmersiveGroups } from '../../integrations/immersivegroups.js';
import { readDebugPreferences, saveDebugPreferences } from '../../core/debug-preferences.js';
import { createSettingsDrawer } from '../../core/settings-panel.js';
import { matchesFilter } from '../../core/record-analysis.js';
import { VERSION } from '../../core/version.js';
import { createLogArchive, createAutoSave } from '../../core/log-archive.js';

export function mountDebug(recorder, context, target, { onStatus = () => {} } = {}) {
    const preferences = readDebugPreferences(context);
    const section = createSettingsDrawer('LunarDebug', 'butterfly', 'lunar-debug');
    const panel = section.drawer;
    const alert = document.createElement('span'); alert.dataset.alert = ''; section.label.append(alert);
    section.content.innerHTML = `
        <label><input type="checkbox" data-record> Record diagnostic metadata</label>
        <label>Maximum retained records <input type="number" min="1000" max="50000" step="1000" data-capacity></label>
        <label><input type="checkbox" data-auto-start> Start recording automatically after reload</label>
        <label><input type="checkbox" data-auto-save> Automatically save logs on this device</label>
        <p>Auto-save keeps the latest five recordings in this browser (up to 2 MB each), with checkpoints every five seconds and after detected errors. Enable automatic recording above to capture future sessions. Browser storage can be cleared or evicted; export important logs.</p>
        <p data-save-status role="status"></p>
        <button type="button" class="menu_button" data-open-logs>Open logs folder</button>
        <section data-saved-logs hidden aria-label="Saved logs"><h4>Saved logs on this device</h4><p>This is a browser-local archive, not a filesystem folder. Logs stay on this device and browser; they are not uploaded or synced. An active recording can reappear after deletion while auto-save is on.</p><div data-log-list></div></section>
        <p>Repeated routine activity is summarized. The newest 200 attention records survive main-buffer rollover. Recordings stay in memory unless you enable local auto-save. Setting names, configuration values and execution states are recorded. API keys, personal/character names, user input and model output are excluded.</p>
        <p data-status role="status"></p><p data-integration></p>
        <div class="lunar-debug-actions"><button type="button" class="menu_button" data-export>Export JSON</button><button type="button" class="menu_button" data-clear>Clear recording</button></div>
        <label>Event filter <select data-filter><option value="">All events</option><option value="review">Needs review (not automatically bugs)</option><option value="loading">Sprite loading / entrances</option><option value="attention">Attention records</option><option value="ui.">UI actions / scrolling</option><option value="ig.setting">Configuration</option><option value="outfit.">Outfits</option><option value="background.">Backgrounds</option><option value="animation.">Animations</option><option value="context.">Context injection</option><option value="automation.">Automation</option><option value="host.">SillyTavern</option><option value="ig.">IG changes</option></select></label>
        <p>Needs review highlights failures, unsupported motion and inconclusive interruptions. Expected activity remains in All events and exports; nearby records do not prove causation.</p><pre data-events aria-label="Recent diagnostic events"></pre>`;
    target.append(panel);
    const query = selector => panel.querySelector(selector);
    let disconnect = null, lastSignature = '', disposed = false, archiveView = 0;
    const archive = createLogArchive();
    const snapshot = () => recorder.export({ lunarCore: VERSION, immersiveGroups: globalThis.ImmersiveGroups?.version });
    const autoSave = createAutoSave({ archive, snapshot, status: text => { if (!disposed && preferences.autoSave) query('[data-save-status]').textContent = text; } });
    const checkpoint = force => { if (preferences.autoSave && !disposed) void autoSave.checkpoint(recorder.stats(), force); };
    function download(data) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'lunar-debug-recording.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function showLogs() {
        const view = ++archiveView, list = query('[data-log-list]');
        list.textContent = 'Loading saved logs…';
        try {
            const entries = await archive.list();
            if (disposed || view !== archiveView) return;
            list.replaceChildren();
            if (!entries.length) list.textContent = 'No saved logs yet.';
            for (const entry of entries) {
                let data;
                try { data = JSON.parse(entry.json); } catch { continue; }
                const row = document.createElement('div'), label = document.createElement('p');
                label.textContent = `Saved log ${entry.id} · ${Number(data.count) || 0} records · ${Number(data.attentionCount) || 0} attention records`;
                row.append(label);
                for (const [name, action] of [['Export JSON', () => download(data)], ['Delete', async () => { try { await archive.remove(entry.id); await showLogs(); } catch { list.textContent = 'Could not delete saved log.'; } }]]) {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'menu_button'; button.textContent = name; button.addEventListener('click', action); row.append(button);
                }
                list.append(row);
            }
        } catch { if (!disposed && view === archiveView) list.textContent = 'Saved logs are unavailable in this browser or storage is blocked.'; }
    }
    query('[data-open-logs]').addEventListener('click', () => { const section = query('[data-saved-logs]'); section.hidden = !section.hidden; if (!section.hidden) void showLogs(); });
    query('[data-auto-save]').checked = preferences.autoSave;
    query('[data-auto-save]').addEventListener('change', event => { preferences.autoSave = event.target.checked; saveDebugPreferences(context, preferences); if (preferences.autoSave) checkpoint(true); else query('[data-save-status]').textContent = 'Auto-save off. Previously saved logs remain until deleted.'; });
    const leaving = () => { disconnect?.flush(); checkpoint(true); };
    const visibility = () => { if (document.hidden) leaving(); };
    window.addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', visibility);
    function attach() {
        disconnect?.(); disconnect = connectImmersiveGroups(recorder.api, context);
        recorder.api.emit('ui.theme', { theme: 'moonlight_blue', enabled: (context.extensionSettings || context.extension_settings)?.LunarCore?.ui?.moonlightBlue === true });
    }
    function render() {
        const stats = recorder.stats();
        checkpoint(false);
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
        const rows = filter === 'attention' ? recorder.attentionEntries() : recorder.entries().filter(row => matchesFilter(row, filter));
        query('[data-events]').textContent = rows.slice(-60).map(row => JSON.stringify(row)).join('\n');
    }
    query('[data-record]').addEventListener('change', event => {
        if (event.target.checked) { autoSave.rotate(); recorder.start(); attach(); }
        else { disconnect?.(); disconnect = null; recorder.stop(); checkpoint(true); }
        render();
    });
    query('[data-clear]').addEventListener('click', () => { disconnect?.(true); disconnect = null; recorder.clear(); autoSave.rotate(); lastSignature = ''; if (recorder.stats().active) attach(); render(); });
    query('[data-filter]').addEventListener('change', render);
    query('[data-filter]').append(new Option('Generation lifecycle', 'generation.'), new Option('Sprite loading', 'sprite.'), new Option('Motion lifecycle', 'motion.'));
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
        download(snapshot());
    });
    const timer = setInterval(render, 500);
    if (preferences.autoStart) { query('[data-record]').checked = true; recorder.start(); attach(); }
    render();
    return () => { disconnect?.(); recorder.stop(); checkpoint(true); disposed = true; clearInterval(timer); window.removeEventListener('pagehide', leaving); document.removeEventListener('visibilitychange', visibility); panel.remove(); };
}
