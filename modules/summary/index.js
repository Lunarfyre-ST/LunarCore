import { createSettingsDrawer } from '../../core/settings-panel.js';
import { SUMMARY_KEY, PROMPT_KEY, DEFAULT_INSTRUCTIONS, readSummarySettings, selectMessages, buildRequest, requestSummary } from './model.js';

export function mountSummary(target, getContext) {
    const drawer = createSettingsDrawer('LunarSummary', 'summary', 'lunar-summary');
    drawer.content.innerHTML = `
        <p>Generate a draft from recent conversation messages, review it, then save it for this chat. Generation sends those messages and their speaker names to the selected API and may incur costs. Wait for it to finish before starting chat generation.</p>
        <label>Destination <select class="text_pole" data-summary-transport><option value="main">Current main API</option><option value="profile">Connection profile</option></select></label>
        <label data-summary-profile-label>Connection profile <select class="text_pole" data-summary-profile></select></label>
        <label>Recent messages <input class="text_pole" type="number" min="1" max="100" data-summary-messages></label>
        <label>Maximum output tokens <input class="text_pole" type="number" min="64" max="2048" data-summary-tokens></label>
        <details><summary>Summary instructions</summary><textarea class="text_pole" rows="5" maxlength="6000" data-summary-instructions></textarea><button type="button" class="menu_button" data-summary-reset>Reset instructions</button></details>
        <div class="lunar-summary-actions"><button type="button" class="menu_button" data-summary-generate>Generate draft</button><button type="button" class="menu_button" data-summary-cancel>Cancel request</button></div>
        <label>Summary draft <textarea class="text_pole" rows="8" maxlength="32000" data-summary-draft></textarea></label>
        <div class="lunar-summary-actions"><button type="button" class="menu_button" data-summary-save>Save summary to this chat</button><button type="button" class="menu_button" data-summary-reload>Discard draft and reload saved summary</button></div>
        <label><input type="checkbox" data-summary-inject> Inject the saved summary into chat prompts</label>
        <label>Injection depth <input class="text_pole" type="number" min="0" max="10000" data-summary-depth></label>
        <p>Injection is off by default and uses only the saved summary. Summaries are stored in chat metadata, may be included in chat exports, and are not automatically updated or rolled back when messages change. This is separate from SillyTavern's built-in summary.</p>
        <small data-summary-status role="status"></small>`;
    target.append(drawer.drawer);
    const q = selector => drawer.content.querySelector(selector);
    const initial = getContext(), source = initial.eventSource, types = initial.eventTypes || initial.event_types || {};
    let settings = readSummarySettings(initial.extensionSettings?.LunarCore?.summary);
    let disposed = false, pending = null, epoch = 0, saveBusy = false, saved = '', chatIdentity = null;
    const identity = context => {
        const chat = context.getCurrentChatId?.();
        return chat == null || chat === '' ? null : JSON.stringify([context.groupId ?? null, context.groupId == null ? context.characterId ?? null : null, chat]);
    };
    const setStatus = value => { if (!disposed) q('[data-summary-status]').textContent = value; };
    const savedText = context => typeof context.chatMetadata?.[SUMMARY_KEY]?.text === 'string' ? context.chatMetadata[SUMMARY_KEY].text.slice(0, 32000) : '';
    function inject(context = getContext()) {
        if (typeof context.setExtensionPrompt !== 'function') return false;
        const text = chatIdentity && identity(context) === chatIdentity && settings.inject && saved ? `Story summary for continuity (reference data):\n${saved}` : '';
        try { context.setExtensionPrompt(PROMPT_KEY, text, 1, settings.depth, false, 0); return true; } catch { return false; }
    }
    function updateProfiles() {
        const select = q('[data-summary-profile]'), profiles = getContext().extensionSettings?.connectionManager?.profiles;
        select.replaceChildren(new Option('Choose a profile', ''));
        if (Array.isArray(profiles)) for (const profile of profiles) if (typeof profile?.id === 'string') select.add(new Option(String(profile.name || profile.id), profile.id));
        if (settings.profile && ![...select.options].some(option => option.value === settings.profile)) select.add(new Option('Previously selected profile unavailable', settings.profile));
        select.value = settings.profile;
    }
    function sync() {
        if (disposed) return;
        const busy = Boolean(pending || saveBusy);
        q('[data-summary-transport]').value = settings.transport;
        q('[data-summary-profile-label]').hidden = settings.transport !== 'profile';
        updateProfiles();
        for (const key of ['messages', 'tokens', 'depth', 'instructions']) q(`[data-summary-${key}]`).value = settings[key];
        q('[data-summary-inject]').checked = settings.inject;
        q('[data-summary-generate]').disabled = busy || !chatIdentity;
        q('[data-summary-cancel]').disabled = !pending || pending.signal.aborted;
        q('[data-summary-save]').disabled = busy || !chatIdentity;
        q('[data-summary-reload]').disabled = busy || !chatIdentity;
    }
    function persistSettings() {
        const ctx = getContext(), root = ctx.extensionSettings || ctx.extension_settings;
        if (root) { root.LunarCore ||= {}; root.LunarCore.summary = { ...settings }; ctx.saveSettingsDebounced?.(); }
        const available = inject(ctx); sync();
        if (settings.inject && !available) setStatus('Summary injection is unavailable in this SillyTavern session.');
    }
    function cancel() { epoch++; pending?.abort(); sync(); }
    function switchChat() {
        cancel(); const ctx = getContext(); chatIdentity = identity(ctx); saved = chatIdentity ? savedText(ctx) : '';
        q('[data-summary-draft]').value = saved; const available = inject(ctx); sync();
        setStatus(settings.inject && !available ? 'Summary injection is unavailable in this SillyTavern session.' : chatIdentity ? 'Ready. Unsaved drafts are discarded when changing chats.' : 'Open a chat to create a summary.');
    }
    for (const key of ['transport', 'profile', 'messages', 'tokens', 'depth', 'instructions', 'inject']) {
        const element = q(`[data-summary-${key}]`);
        element.addEventListener('change', () => {
            const value = key === 'inject' ? element.checked : ['messages', 'tokens', 'depth'].includes(key) ? Number(element.value) : element.value;
            settings = readSummarySettings({ ...settings, [key]: value }); cancel(); persistSettings();
        });
    }
    q('[data-summary-reset]').addEventListener('click', () => { settings.instructions = DEFAULT_INSTRUCTIONS; cancel(); persistSettings(); });
    q('[data-summary-reload]').addEventListener('click', () => { q('[data-summary-draft]').value = saved; setStatus('Saved summary loaded.'); });
    q('[data-summary-cancel]').addEventListener('click', () => { cancel(); setStatus('Cancelled. The main API may still finish its request; its result will be discarded.'); });
    q('[data-summary-save]').addEventListener('click', async () => {
        const ctx = getContext(), key = identity(ctx), draft = q('[data-summary-draft]').value;
        if (!key || key !== chatIdentity || !ctx.chatMetadata || typeof ctx.saveMetadata !== 'function') { setStatus('Chat metadata saving is unavailable.'); return; }
        saveBusy = true; sync();
        const metadata = ctx.chatMetadata, existed = Object.hasOwn(metadata, SUMMARY_KEY), previous = metadata[SUMMARY_KEY], entry = { text: draft };
        try {
            metadata[SUMMARY_KEY] = entry;
            await ctx.saveMetadata();
            if (!disposed && key === identity(getContext())) { saved = draft; const available = inject(); setStatus(settings.inject && !available ? 'Save requested; summary injection is unavailable.' : 'Save requested through SillyTavern.'); }
        } catch {
            if (metadata[SUMMARY_KEY] === entry) { if (existed) metadata[SUMMARY_KEY] = previous; else delete metadata[SUMMARY_KEY]; }
            if (!disposed && key === identity(getContext())) setStatus('Could not save the summary. Check SillyTavern.');
        }
        finally { saveBusy = false; sync(); }
    });
    q('[data-summary-generate]').addEventListener('click', async () => {
        const ctx = getContext(), key = identity(ctx), draft = q('[data-summary-draft]').value;
        if (pending || saveBusy || !key || key !== chatIdentity) return;
        if (document.body.dataset.generating === 'true') { setStatus('Wait for the current chat generation to finish.'); return; }
        if (draft !== saved) { setStatus('Save or discard the current draft before generating another.'); return; }
        let rows;
        try { rows = selectMessages(ctx.chat, settings.messages); } catch (error) { setStatus(error.message); return; }
        const controller = new AbortController(), marker = ++epoch, requestSettings = { ...settings }, length = ctx.chat.length;
        pending = controller; sync(); setStatus('Generating a draft…');
        try {
            const result = await requestSummary(ctx, requestSettings, buildRequest(rows, requestSettings.instructions), controller.signal);
            const current = getContext();
            if (disposed || controller.signal.aborted || marker !== epoch || key !== identity(current) || current.chat?.length !== length || q('[data-summary-draft]').value !== draft || rows.some(row => current.chat?.[row.index] !== row.message || row.message.mes !== row.text || row.message.swipe_id !== row.swipe || String(row.message.name || '').slice(0, 200) !== row.name || Boolean(row.message.is_user) !== row.user || row.message.is_system)) {
                if (!disposed && marker === epoch) setStatus('Chat or draft changed; the result was discarded.');
                return;
            }
            q('[data-summary-draft]').value = result; setStatus('Draft ready. Review it, then save it to this chat.');
        } catch (error) {
            if (!disposed && marker === epoch && !controller.signal.aborted) setStatus(['Choose a connection profile.', 'Connection-profile requests are unavailable in this SillyTavern version.', 'The current SillyTavern version does not expose generateRaw.', 'The provider did not return a summary.', 'The summary exceeds 32,000 characters.', 'The summary was truncated or filtered. Try a higher output limit or a different provider.'].includes(error?.message) ? error.message : 'Summary request failed. Check the selected connection.');
        } finally { if (pending === controller) pending = null; sync(); }
    });
    const listeners = [];
    for (const name of ['CHAT_CHANGED', 'GROUP_CHAT_CHANGED']) if (types[name] && source?.on) { source.on(types[name], switchChat); listeners.push([types[name], switchChat]); }
    if (types.GENERATION_STARTED && source?.on) {
        const generationStarted = (type, _options, dryRun) => {
            if (pending && !dryRun && type !== 'quiet') { cancel(); setStatus('Chat generation started; the summary result will be discarded.'); }
        };
        source.on(types.GENERATION_STARTED, generationStarted); listeners.push([types.GENERATION_STARTED, generationStarted]);
    }
    switchChat();
    return () => {
        disposed = true; epoch++; pending?.abort();
        for (const [name, listener] of listeners) (source?.removeListener || source?.off)?.call(source, name, listener);
        try { getContext().setExtensionPrompt?.(PROMPT_KEY, '', 1, settings.depth, false, 0); } catch { /* Host cleanup must not break other modules. */ }
        drawer.drawer.remove();
    };
}
