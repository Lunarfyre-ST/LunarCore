import { connectImmersiveGroups } from '../../integrations/immersivegroups.js';

export function mountDebug(recorder, context, target) {
    const panel = document.createElement('div');
    panel.className = 'lunar-debug inline-drawer';
    panel.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b>LunarDebug</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content">
        <label><input type="checkbox" data-record> Record diagnostic metadata</label>
        <p>Recording starts off after every reload. Chat text, prompts, names, filenames, paths and credentials are excluded. Records stay in memory until exported or the page closes.</p>
        <p data-status role="status"></p><p data-integration></p>
        <div class="lunar-debug-actions"><button type="button" class="menu_button" data-export>Export JSON</button><button type="button" class="menu_button" data-clear>Clear recording</button></div>
        <label>Event filter <select data-filter><option value="">All events</option><option value="outfit.">Outfits</option><option value="background.">Backgrounds</option><option value="animation.">Animations</option><option value="context.">Context injection</option><option value="automation.">Automation</option><option value="host.">SillyTavern</option><option value="ig.">IG changes</option></select></label>
        <pre data-events aria-label="Recent diagnostic events"></pre></div>`;
    target.append(panel);
    const query = selector => panel.querySelector(selector);
    let disconnect = null, lastSignature = '';
    function attach() { disconnect?.(); disconnect = connectImmersiveGroups(recorder.api, context); }
    function render() {
        const stats = recorder.stats();
        query('[data-status]').textContent = `${stats.active ? 'Recording' : 'Stopped'} · ${stats.count}/${stats.capacity} events · ${stats.dropped} oldest events discarded`;
        const ig = globalThis.ImmersiveGroups;
        query('[data-integration]').textContent = !ig ? 'ImmersiveGroups not detected.' : ig.diagnosticsProtocol === 1 ? 'ImmersiveGroups: detailed diagnostic hooks available.' : 'ImmersiveGroups: basic events only. Detailed hooks require the instrumented version.';
        query('[data-export]').disabled = stats.count === 0;
        const filter = query('[data-filter]').value, signature = `${stats.count}:${stats.dropped}:${stats.active}:${filter}`;
        if (signature === lastSignature) return;
        lastSignature = signature;
        query('[data-events]').textContent = recorder.entries().filter(row => !filter || row.event.startsWith(filter)).slice(-60).map(row => JSON.stringify(row)).join('\n');
    }
    query('[data-record]').addEventListener('change', event => {
        if (event.target.checked) { recorder.start(); attach(); }
        else { disconnect?.(); disconnect = null; recorder.stop(); }
        render();
    });
    query('[data-clear]').addEventListener('click', () => { recorder.clear(); lastSignature = ''; if (recorder.stats().active) attach(); render(); });
    query('[data-filter]').addEventListener('change', render);
    query('[data-export]').addEventListener('click', () => {
        const data = recorder.export({ lunarCore: '0.0.1', immersiveGroups: globalThis.ImmersiveGroups?.version });
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'lunar-debug-recording.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const timer = setInterval(render, 500);
    render();
    return () => { disconnect?.(); recorder.stop(); clearInterval(timer); panel.remove(); };
}
