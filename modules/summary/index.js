import { createSettingsDrawer } from '../../core/settings-panel.js';
import { SUMMARY_KEY, PROMPT_KEY, DEFAULT_INSTRUCTIONS, readSummarySettings, selectMessages, buildRequest, requestSummary, readSegments, composeSegments } from './model.js';

export function mountSummary(target, getContext) {
    const drawer = createSettingsDrawer('LunarSummary', 'summary', 'lunar-summary');
    drawer.content.innerHTML = `
        <div class="lunar-summary-context"><strong>Context estimate</strong><progress data-summary-meter max="1" value="0"></progress><small data-summary-meter-label>Open a chat for an estimate.</small><small data-summary-stats></small><button type="button" class="menu_button" data-summary-meter-refresh>Refresh estimate</button><small>Conversation and enabled LunarSummary text only. Cards, lore, other extensions, formatting and reserved output are excluded; this is not the full prompt.</small></div>
        <div data-summary-blocks class="lunar-summary-blocks" aria-label="Saved summary blocks"></div>
        <p>Generate and review a summary for the next unsummarized messages. The selected API receives their text and speaker names and may charge for the request. Wait for the request before starting chat generation.</p>
        <label>Destination <select class="text_pole" data-summary-transport><option value="main">Current main API</option><option value="profile">Connection profile</option></select></label>
        <label data-summary-profile-label>Connection profile <select class="text_pole" data-summary-profile></select></label>
        <label>Messages per block <input class="text_pole" type="number" min="1" max="100" data-summary-messages></label>
        <label>Maximum output tokens <input class="text_pole" type="number" min="64" max="2048" data-summary-tokens></label>
        <details><summary>Summary instructions</summary><textarea class="text_pole" rows="5" maxlength="6000" data-summary-instructions></textarea><button type="button" class="menu_button" data-summary-reset>Reset instructions</button></details>
        <div class="lunar-summary-actions"><button type="button" class="menu_button" data-summary-generate>Generate draft</button><button type="button" class="menu_button" data-summary-cancel>Cancel request</button></div>
        <label><input type="checkbox" data-summary-auto> Automatically summarize full blocks after replies</label><small>Off by default. Automatic summaries are saved without review and send messages to the selected provider.</small>
        <button type="button" class="menu_button" data-summary-catch-up>Summarize all complete missing blocks</button><small>Processes complete blocks through the current chat position, leaving any partial block for later. Blocks are saved without review; each request can incur cost.</small>
        <label>Summarize through message number <input class="text_pole" type="number" min="1" step="1" data-summary-through></label><button type="button" class="menu_button" data-summary-force>Summarize through this message</button><small>Runs as many requests as needed and saves each block. Each request can incur cost.</small>
        <label>Summary draft <textarea class="text_pole" rows="8" maxlength="32000" data-summary-draft></textarea></label>
        <div class="lunar-summary-actions"><button type="button" class="menu_button" data-summary-save>Save summary block</button><button type="button" class="menu_button" data-summary-reload>Discard draft</button><button type="button" class="menu_button" data-summary-unhide>Unhide LunarSummary messages</button></div>
        <label><input type="checkbox" data-summary-ghost> Ghost summarized messages after saving</label>
        <label><input type="checkbox" data-summary-inject> Inject the saved summary into chat prompts</label>
        <label>Summary position <select class="text_pole" data-summary-position><option value="above">Above chat history</option><option value="chat">In chat at depth</option></select></label>
        <label>Injection depth <input class="text_pole" type="number" min="0" max="10000" data-summary-depth></label>
        <p>Summaries and message markers are saved with the chat. Ghosted messages stay visible but leave native prompt history. Unhiding restores only messages ghosted by LunarSummary. Turn on summary injection before ghosting; review blocks after editing, swiping, or deleting their messages.</p>
        <small data-summary-status role="status"></small>`;
    target.append(drawer.drawer);
    const q = selector => drawer.content.querySelector(selector);
    const initial = getContext(), source = initial.eventSource, types = initial.eventTypes || initial.event_types || {};
    let settings = readSummarySettings(initial.extensionSettings?.LunarCore?.summary);
    let disposed = false, pending = null, epoch = 0, meterSerial = 0, saveBusy = false, groupRunning = false, saved = '', segments = [], draftRows = null, editingId = null, chatIdentity = null, batchMode = null, autoTimer = null;
    const identity = context => {
        const chat = context.getCurrentChatId?.();
        return chat == null || chat === '' ? null : JSON.stringify([context.groupId ?? null, context.groupId == null ? context.characterId ?? null : null, chat]);
    };
    const setStatus = value => { if (!disposed) q('[data-summary-status]').textContent = value; };
    function renderBlocks() {
        const list = q('[data-summary-blocks]'); list.replaceChildren();
        if (!segments.length) { list.textContent = 'No summary blocks yet.'; return; }
        for (const block of segments) {
            const item = document.createElement('article'); item.className = 'lunar-summary-block';
            const body = document.createElement('div'); body.textContent = block.text;
            const indices = (getContext().chat || []).flatMap((message, index) => message?.extra?.lunarSummaryBlock === block.id ? [index + 1] : []);
            const label = document.createElement('small'); label.textContent = block.count === 0 ? 'Earlier summary / note' : `Messages ${indices[0] ?? block.start}–${indices.at(-1) ?? block.end}${block.stale ? ' · needs review' : ''}`;
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'menu_button'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${label.textContent}`);
            edit.addEventListener('click', () => {
                if (pending || saveBusy || batchMode) return;
                if (q('[data-summary-draft]').value.trim()) { setStatus('Save or discard the current draft before editing a block.'); return; }
                editingId = block.id; draftRows = null; q('[data-summary-draft]').value = block.text; setStatus('Editing saved block. Save or discard the draft.');
            });
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'menu_button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete ${label.textContent}`);
            remove.addEventListener('click', () => deleteBlock(block.id));
            item.append(body, label, edit, remove); list.append(item);
        }
    }
    function inject(context = getContext()) {
        if (typeof context.setExtensionPrompt !== 'function') return false;
        const text = chatIdentity && identity(context) === chatIdentity && settings.inject && saved ? `Story summary for continuity (reference data):\n${saved}` : '';
        try { context.setExtensionPrompt(PROMPT_KEY, text, settings.position === 'above' ? 0 : 1, settings.depth, false, 0); return true; } catch { return false; }
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
        q('[data-summary-auto]').checked = settings.auto;
        q('[data-summary-ghost]').checked = settings.ghost;
        q('[data-summary-position]').value = settings.position;
        q('[data-summary-depth]').disabled = settings.position !== 'chat';
        q('[data-summary-generate]').disabled = busy || !chatIdentity;
        q('[data-summary-cancel]').disabled = !batchMode && (!pending || pending.signal.aborted);
        q('[data-summary-save]').disabled = busy || !chatIdentity;
        q('[data-summary-reload]').disabled = busy || !chatIdentity;
        q('[data-summary-unhide]').disabled = busy || !chatIdentity || Boolean(batchMode);
        q('[data-summary-force]').disabled = busy || !chatIdentity || Boolean(batchMode);
        q('[data-summary-catch-up]').disabled = busy || !chatIdentity || Boolean(batchMode);
    }
    function persistSettings() {
        const ctx = getContext(), root = ctx.extensionSettings || ctx.extension_settings;
        if (root) { root.LunarCore ||= {}; root.LunarCore.summary = { ...settings }; ctx.saveSettingsDebounced?.(); }
        const available = inject(ctx); sync();
        if (settings.inject && !available) setStatus('Summary injection is unavailable in this SillyTavern session.');
        updateMeter();
    }
    async function updateMeter() {
        const serial = ++meterSerial, ctx = getContext(), key = identity(ctx), max = Number(ctx.maxContext);
        const text = (Array.isArray(ctx.chat) ? ctx.chat : []).filter(message => message && !message.is_system && typeof message.mes === 'string').map(message => `${message.name || ''}: ${message.mes}`).join('\n');
        const included = settings.inject ? saved : '';
        let count, summaryCount, estimated = false;
        try { if (typeof ctx.getTokenCountAsync === 'function') [count, summaryCount] = await Promise.all([ctx.getTokenCountAsync(`${text}\n${included}`, 0), ctx.getTokenCountAsync(saved, 0)]); } catch { /* Use a rough fallback. */ }
        if (!Number.isFinite(count)) { count = Math.ceil((text.length + included.length) / 4); estimated = true; }
        if (!Number.isFinite(summaryCount)) { summaryCount = Math.ceil(saved.length / 4); estimated = true; }
        if (disposed || serial !== meterSerial || key !== identity(getContext())) return;
        const meter = q('[data-summary-meter]');
        meter.max = Number.isFinite(max) && max > 0 ? max : 1; meter.value = Math.min(meter.max, count);
        q('[data-summary-meter-label]').textContent = key ? `${estimated ? 'Rough estimate' : 'Tokenizer count'}: ${count.toLocaleString()} tokens${max > 0 ? ` of ${max.toLocaleString()} configured context tokens` : ' (context limit unavailable)'}.` : 'Open a chat for an estimate.';
        const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
        const summarized = chat.filter(message => message?.extra?.lunarSummaryBlock).length;
        const hidden = chat.filter(message => message?.is_system).length;
        const owned = chat.filter(message => message?.is_system && message.extra?.lunarSummaryGhost === true).length;
        q('[data-summary-stats]').textContent = `${summarized} summarized messages · ${hidden} hidden/system (${owned} by LunarSummary) · ${estimated ? 'about ' : ''}${summaryCount.toLocaleString()} summary tokens`;
    }
    function cancel() { epoch++; pending?.abort(); batchMode = null; clearTimeout(autoTimer); autoTimer = null; sync(); }
    function unmark(ctx, blockId, removeCoverage) {
        const changed = [];
        for (const [index, message] of (ctx.chat || []).entries()) if (message?.extra?.lunarSummaryBlock === blockId) {
            const extra = message.extra, oldSystem = message.is_system, ghost = extra.lunarSummaryGhost === true;
            changed.push({ index, message, oldSystem, ghost, blockId });
            if (ghost) { delete extra.lunarSummaryGhost; if (message.is_system) message.is_system = false; document.querySelector(`#chat .mes[mesid="${index}"]`)?.setAttribute('is_system', String(Boolean(message.is_system))); }
            if (removeCoverage) delete extra.lunarSummaryBlock;
        }
        return changed;
    }
    function restoreMarks(changed) {
        for (const { index, message, oldSystem, ghost, blockId } of changed) {
            message.extra.lunarSummaryBlock = blockId;
            if (ghost) message.extra.lunarSummaryGhost = true;
            message.is_system = oldSystem;
            document.querySelector(`#chat .mes[mesid="${index}"]`)?.setAttribute('is_system', String(Boolean(oldSystem)));
        }
    }
    async function deleteBlock(id) {
        const ctx = getContext(), key = identity(ctx);
        if (pending || saveBusy || batchMode || !key || key !== chatIdentity || !ctx.chatMetadata || typeof ctx.saveMetadata !== 'function') return;
        if (editingId === id) { setStatus('Save or discard this block edit first.'); return; }
        if (groupRunning || document.body.dataset.generating === 'true') { setStatus('Wait for chat generation to finish.'); return; }
        saveBusy = true; sync(); const previous = ctx.chatMetadata?.[SUMMARY_KEY], changed = unmark(ctx, id, true), next = segments.filter(block => block.id !== id);
        const entry = { version: 2, segments: next, text: composeSegments(next) }; ctx.chatMetadata[SUMMARY_KEY] = entry;
        try { await ctx.saveMetadata(); if (!disposed && key === identity(getContext())) { segments = next; saved = entry.text; renderBlocks(); inject(); updateMeter(); setStatus('Block deleted and its ghosted messages restored.'); } }
        catch { restoreMarks(changed); if (ctx.chatMetadata[SUMMARY_KEY] === entry) ctx.chatMetadata[SUMMARY_KEY] = previous; if (!disposed && key === identity(getContext())) setStatus('Could not delete this block.'); }
        finally { saveBusy = false; sync(); }
    }
    function switchChat() {
        cancel(); groupRunning = false; const ctx = getContext(); chatIdentity = identity(ctx); segments = chatIdentity ? readSegments(ctx.chatMetadata?.[SUMMARY_KEY]) : []; saved = composeSegments(segments); draftRows = null; editingId = null;
        const incomplete = segments.filter(block => !block.stale && block.count > 0 && (ctx.chat || []).filter(message => message?.extra?.lunarSummaryBlock === block.id).length !== block.count);
        if (incomplete.length) {
            for (const block of incomplete) { block.stale = true; unmark(ctx, block.id, false); }
            saved = composeSegments(segments); ctx.chatMetadata[SUMMARY_KEY] = { version: 2, segments, text: saved };
            Promise.resolve().then(() => ctx.saveMetadata?.()).catch(() => setStatus('Could not persist restored messages.'));
        }
        q('[data-summary-draft]').value = ''; renderBlocks(); const available = inject(ctx); let restored = 0;
        if (!settings.inject || !available) for (const [index, message] of (ctx.chat || []).entries()) if (message?.extra?.lunarSummaryGhost === true) {
            delete message.extra.lunarSummaryGhost; if (message.is_system) message.is_system = false;
            document.querySelector(`#chat .mes[mesid="${index}"]`)?.setAttribute('is_system', String(Boolean(message.is_system))); restored++;
        }
        if (restored) Promise.resolve().then(() => ctx.saveMetadata?.()).catch(() => setStatus('Could not persist restored messages.'));
        sync();
        setStatus(restored ? 'Summary injection is off or unavailable; LunarSummary messages were restored.' : incomplete.length ? 'A saved block no longer matches its messages. Remaining messages were unhidden; delete and regenerate the block.' : settings.inject && !available ? 'Summary injection is unavailable in this SillyTavern session.' : chatIdentity ? 'Ready. Unsaved drafts are discarded when changing chats.' : 'Open a chat to create a summary.');
        updateMeter();
    }
    for (const key of ['transport', 'profile', 'messages', 'tokens', 'depth', 'position', 'instructions', 'inject', 'auto', 'ghost']) {
        const element = q(`[data-summary-${key}]`);
        element.addEventListener('change', () => {
            if (key === 'inject' && !element.checked && (getContext().chat || []).some(message => message?.extra?.lunarSummaryGhost === true && message.is_system)) {
                element.checked = true; setStatus('Unhide LunarSummary messages before disabling summary injection.'); return;
            }
            const value = ['inject', 'auto', 'ghost'].includes(key) ? element.checked : ['messages', 'tokens', 'depth'].includes(key) ? Number(element.value) : element.value;
            settings = readSummarySettings({ ...settings, [key]: value }); cancel(); persistSettings();
        });
    }
    q('[data-summary-reset]').addEventListener('click', () => { settings.instructions = DEFAULT_INSTRUCTIONS; cancel(); persistSettings(); });
    q('[data-summary-reload]').addEventListener('click', () => { draftRows = null; editingId = null; q('[data-summary-draft]').value = ''; setStatus('Draft discarded.'); });
    q('[data-summary-cancel]').addEventListener('click', () => { cancel(); setStatus('Cancelled. The main API may still finish its request; its result will be discarded.'); });
    q('[data-summary-save]').addEventListener('click', async () => {
        const ctx = getContext(), key = identity(ctx), draft = q('[data-summary-draft]').value;
        if (!key || key !== chatIdentity || !ctx.chatMetadata || typeof ctx.saveMetadata !== 'function') { setStatus('Chat metadata saving is unavailable.'); return; }
        if (groupRunning || document.body.dataset.generating === 'true') { batchMode = null; sync(); setStatus('Wait for chat generation to finish before saving.'); return; }
        if (!draft.trim()) { setStatus('Write or generate a summary block first.'); return; }
        if (editingId) {
            const previous = ctx.chatMetadata[SUMMARY_KEY], next = segments.map(block => block.id === editingId ? { ...block, text: draft } : block);
            if (!segments.some(block => block.id === editingId)) { setStatus('The selected block is no longer available.'); return; }
            const entry = { version: 2, segments: next, text: composeSegments(next) }; saveBusy = true; sync(); ctx.chatMetadata[SUMMARY_KEY] = entry;
            try { await ctx.saveMetadata(); if (!disposed && key === identity(getContext())) { segments = next; saved = entry.text; editingId = null; q('[data-summary-draft]').value = ''; renderBlocks(); inject(); updateMeter(); setStatus('Block updated.'); } }
            catch { if (ctx.chatMetadata[SUMMARY_KEY] === entry) ctx.chatMetadata[SUMMARY_KEY] = previous; if (!disposed && key === identity(getContext())) setStatus('Could not save the block edit.'); }
            finally { saveBusy = false; sync(); }
            return;
        }
        if (q('[data-summary-ghost]').checked && (!settings.inject || !draftRows || !inject(ctx))) { batchMode = null; sync(); setStatus('Enable available summary injection and generate a draft before ghosting its messages.'); return; }
        if (draftRows && draftRows.some(row => ctx.chat?.[row.index] !== row.message || row.message.mes !== row.text || row.message.swipe_id !== row.swipe || String(row.message.name || '').slice(0, 200) !== row.name || Boolean(row.message.is_user) !== row.user || row.message.is_system || row.message.extra?.lunarSummaryBlock)) { batchMode = null; sync(); setStatus('The selected messages changed; discard and regenerate this draft.'); return; }
        saveBusy = true; sync();
        const metadata = ctx.chatMetadata, existed = Object.hasOwn(metadata, SUMMARY_KEY), previous = metadata[SUMMARY_KEY];
        const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, block = { id, text: draft, start: draftRows ? draftRows[0].index + 1 : 0, end: draftRows ? draftRows.at(-1).index + 1 : 0, count: draftRows?.length || 0, stale: false };
        const next = [...segments, block], entry = { version: 2, segments: next, text: composeSegments(next) };
        const changed = [], previousSaved = saved;
        try {
            // Publish the replacement context before excluding any original messages.
            // A chat generation started during the host save still has continuity.
            if (q('[data-summary-ghost]').checked) { saved = entry.text; if (!inject(ctx)) throw new Error('Injection unavailable'); }
            for (const row of draftRows || []) {
                const message = row.message, extra = message.extra ||= {};
                changed.push({ row, oldSystem: message.is_system });
                extra.lunarSummaryBlock = id;
                if (q('[data-summary-ghost]').checked) { extra.lunarSummaryGhost = true; message.is_system = true; document.querySelector(`#chat .mes[mesid="${row.index}"]`)?.setAttribute('is_system', 'true'); }
            }
            metadata[SUMMARY_KEY] = entry;
            await ctx.saveMetadata();
            if (!disposed && key === identity(getContext())) {
                const invalid = (draftRows || []).some(row => ctx.chat?.[row.index] !== row.message || row.message.mes !== row.text || row.message.swipe_id !== row.swipe || String(row.message.name || '').slice(0, 200) !== row.name || Boolean(row.message.is_user) !== row.user);
                if (invalid) { block.stale = true; unmark(ctx, id, false); entry.text = composeSegments(next); await ctx.saveMetadata(); batchMode = null; }
                segments = next; saved = entry.text; draftRows = null; q('[data-summary-draft]').value = ''; renderBlocks(); const available = inject(); updateMeter();
                setStatus(invalid ? 'Messages changed during saving; the block needs review and its messages were restored.' : settings.inject && !available ? 'Save requested; summary injection is unavailable.' : 'Summary block saved to chat.');
            }
        } catch {
            for (const { row, oldSystem } of changed) if (row.message.extra?.lunarSummaryBlock === id) { delete row.message.extra.lunarSummaryBlock; delete row.message.extra.lunarSummaryGhost; row.message.is_system = oldSystem; document.querySelector(`#chat .mes[mesid="${row.index}"]`)?.setAttribute('is_system', String(Boolean(oldSystem))); }
            if (metadata[SUMMARY_KEY] === entry) { if (existed) metadata[SUMMARY_KEY] = previous; else delete metadata[SUMMARY_KEY]; }
            batchMode = null; if (!disposed && key === identity(getContext())) { saved = previousSaved; inject(); setStatus('Could not save the summary. Check SillyTavern.'); }
        }
        finally { saveBusy = false; sync(); if (!disposed && batchMode) setTimeout(nextBatch, 0); }
    });
    q('[data-summary-generate]').addEventListener('click', async () => {
        const ctx = getContext(), key = identity(ctx), draft = q('[data-summary-draft]').value;
        if (pending || saveBusy || !key || key !== chatIdentity) return;
        if (document.body.dataset.generating === 'true') { setStatus('Wait for the current chat generation to finish.'); return; }
        if (draft.trim()) { setStatus('Save or discard the current draft before generating another.'); return; }
        let rows;
        try { rows = selectMessages(batchMode?.limit ? ctx.chat.slice(0, batchMode.limit) : ctx.chat, settings.messages); } catch (error) { batchMode = null; sync(); setStatus(error.message); return; }
        const controller = new AbortController(), marker = ++epoch, requestSettings = { ...settings }, length = ctx.chat.length;
        pending = controller; sync(); setStatus('Generating a draft…');
        try {
            const result = await requestSummary(ctx, requestSettings, buildRequest(rows, requestSettings.instructions), controller.signal);
            const current = getContext();
            if (disposed || controller.signal.aborted || marker !== epoch || key !== identity(current) || current.chat?.length !== length || q('[data-summary-draft]').value !== draft || rows.some(row => current.chat?.[row.index] !== row.message || row.message.mes !== row.text || row.message.swipe_id !== row.swipe || String(row.message.name || '').slice(0, 200) !== row.name || Boolean(row.message.is_user) !== row.user || row.message.is_system)) {
                if (!disposed && marker === epoch) { batchMode = null; setStatus('Chat or draft changed; the result was discarded.'); }
                return;
            }
            draftRows = rows; q('[data-summary-draft]').value = result; setStatus(`Draft ready for messages ${rows[0].index + 1}–${rows.at(-1).index + 1}. Review and save it.`);
            if (batchMode) queueMicrotask(() => { if (!disposed && batchMode && marker === epoch && !pending) q('[data-summary-save]').click(); });
        } catch (error) {
            if (!disposed && marker === epoch && !controller.signal.aborted) { batchMode = null; setStatus(['Choose a connection profile.', 'Connection-profile requests are unavailable in this SillyTavern version.', 'The current SillyTavern version does not expose generateRaw.', 'The provider did not return a summary.', 'The summary exceeds 32,000 characters.', 'The summary was truncated or filtered. Try a higher output limit or a different provider.'].includes(error?.message) ? error.message : 'Summary request failed. Check the selected connection.'); }
        } finally { if (pending === controller) pending = null; sync(); }
    });
    function nextBatch() {
        if (!batchMode || disposed || pending || saveBusy || identity(getContext()) !== chatIdentity) return;
        if (document.body.dataset.generating === 'true' || groupRunning) { autoTimer = setTimeout(nextBatch, 1000); return; }
        const ctx = getContext();
        if (!ctx.chatMetadata || typeof ctx.saveMetadata !== 'function') { batchMode = null; sync(); setStatus('Chat saving is unavailable.'); return; }
        if (q('[data-summary-ghost]').checked && (!settings.inject || !inject(ctx))) { batchMode = null; sync(); setStatus('Enable available summary injection before ghosting messages.'); return; }
        if (q('[data-summary-draft]').value.trim()) { batchMode = null; sync(); setStatus('Save or discard the draft before running batches.'); return; }
        let rows;
        try { rows = selectMessages(batchMode.limit ? getContext().chat.slice(0, batchMode.limit) : getContext().chat, settings.messages); } catch (error) { batchMode = null; sync(); setStatus(error.message.includes('no conversation') ? 'Summarization is complete through the selected point.' : error.message); return; }
        if (batchMode.automatic && rows.length < settings.messages) { const catchUp = batchMode.catchUp; batchMode = null; sync(); setStatus(catchUp ? 'Complete missing blocks summarized; any partial block remains for later.' : 'Waiting for a full block of new messages.'); return; }
        q('[data-summary-generate]').click();
    }
    function scheduleAutomatic() {
        if (!settings.auto || batchMode || pending || saveBusy || !chatIdentity || q('[data-summary-draft]').value.trim()) return;
        if (getContext().groupId != null && (!types.GROUP_WRAPPER_STARTED || !types.GROUP_WRAPPER_FINISHED)) { setStatus('Automatic group summaries require group-round events from SillyTavern. Use manual or force summarization.'); return; }
        batchMode = { automatic: true }; nextBatch();
    }
    q('[data-summary-catch-up]').addEventListener('click', () => {
        const limit = getContext().chat?.length || 0;
        if (!limit) { setStatus('There are no complete missing blocks to summarize.'); return; }
        if (q('[data-summary-ghost]').checked && !settings.inject) { setStatus('Enable summary injection before ghosting messages.'); return; }
        batchMode = { automatic: true, catchUp: true, limit }; sync(); nextBatch();
    });
    q('[data-summary-force]').addEventListener('click', () => {
        const limit = Number(q('[data-summary-through]').value), count = getContext().chat?.length || 0;
        if (!Number.isInteger(limit) || limit < 1 || limit > count) { setStatus(`Choose a message number between 1 and ${count}.`); return; }
        if (q('[data-summary-ghost]').checked && !settings.inject) { setStatus('Enable summary injection before ghosting messages.'); return; }
        batchMode = { automatic: false, limit }; sync(); nextBatch();
    });
    q('[data-summary-unhide]').addEventListener('click', async () => {
        const ctx = getContext(), key = identity(ctx);
        if (!key || key !== chatIdentity || typeof ctx.saveMetadata !== 'function') { setStatus('Chat saving is unavailable.'); return; }
        if (groupRunning || document.body.dataset.generating === 'true') { setStatus('Wait for chat generation to finish.'); return; }
        const changed = [];
        for (const [index, message] of (ctx.chat || []).entries()) if (message?.extra?.lunarSummaryGhost === true) {
            changed.push({ index, message, oldSystem: message.is_system }); delete message.extra.lunarSummaryGhost;
            if (message.is_system) { message.is_system = false; document.querySelector(`#chat .mes[mesid="${index}"]`)?.setAttribute('is_system', 'false'); }
        }
        if (!changed.length) { setStatus('No LunarSummary messages are hidden.'); return; }
        saveBusy = true; sync();
        try { await ctx.saveMetadata(); if (!disposed && key === identity(getContext())) { updateMeter(); setStatus(`Unhid ${changed.length} LunarSummary messages. Summaries remain saved.`); } }
        catch { for (const { index, message, oldSystem } of changed) { message.extra.lunarSummaryGhost = true; message.is_system = oldSystem; document.querySelector(`#chat .mes[mesid="${index}"]`)?.setAttribute('is_system', String(Boolean(oldSystem))); } if (!disposed && key === identity(getContext())) setStatus('Could not save restored messages.'); }
        finally { saveBusy = false; sync(); }
    });
    const listeners = [];
    q('[data-summary-meter-refresh]').addEventListener('click', updateMeter);
    for (const name of ['CHAT_CHANGED', 'GROUP_CHAT_CHANGED']) if (types[name] && source?.on) { source.on(types[name], switchChat); listeners.push([types[name], switchChat]); }
    for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED']) if (types[name] && source?.on) {
        const onMessage = messageId => {
            const ctx = getContext();
            if (['MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED'].includes(name)) {
                const changedId = typeof messageId === 'number' || typeof messageId === 'string' && /^\d+$/.test(messageId) ? Number(messageId) : -1, changedBlock = name !== 'MESSAGE_DELETED' && Number.isInteger(changedId) && changedId >= 0 ? ctx.chat?.[changedId]?.extra?.lunarSummaryBlock : null;
                const stale = segments.filter(block => !block.stale && block.count > 0 && (block.id === changedBlock || (ctx.chat || []).filter(message => message?.extra?.lunarSummaryBlock === block.id).length !== block.count));
                if (stale.length) {
                    cancel();
                    for (const block of stale) { block.stale = true; unmark(ctx, block.id, false); }
                    saved = composeSegments(segments);
                    if (ctx.chatMetadata?.[SUMMARY_KEY]) ctx.chatMetadata[SUMMARY_KEY] = { version: 2, segments, text: saved };
                    inject(ctx); renderBlocks();
                    Promise.resolve().then(() => ctx.saveMetadata?.()).catch(() => setStatus('Could not persist restored messages.'));
                    setStatus('A summarized message changed. Its block needs review and its messages were unhidden. Delete the block to summarize them again.');
                }
            }
            updateMeter();
            if (name === 'MESSAGE_RECEIVED') { clearTimeout(autoTimer); autoTimer = setTimeout(scheduleAutomatic, 1000); }
        };
        source.on(types[name], onMessage); listeners.push([types[name], onMessage]);
    }
    if (types.GENERATION_STARTED && source?.on) {
        const generationStarted = (type, _options, dryRun) => {
            if (pending && !dryRun && type !== 'quiet') { cancel(); setStatus('Chat generation started; the summary result will be discarded.'); }
        };
        source.on(types.GENERATION_STARTED, generationStarted); listeners.push([types.GENERATION_STARTED, generationStarted]);
    }
    if (types.GROUP_WRAPPER_STARTED && source?.on) {
        const onGroupStarted = () => { groupRunning = true; };
        source.on(types.GROUP_WRAPPER_STARTED, onGroupStarted); listeners.push([types.GROUP_WRAPPER_STARTED, onGroupStarted]);
    }
    for (const name of ['GENERATION_ENDED', 'GROUP_WRAPPER_FINISHED']) if (types[name] && source?.on) {
        const onFinished = () => { if (name === 'GROUP_WRAPPER_FINISHED') groupRunning = false; clearTimeout(autoTimer); autoTimer = setTimeout(() => batchMode ? nextBatch() : scheduleAutomatic(), 1000); };
        source.on(types[name], onFinished); listeners.push([types[name], onFinished]);
    }
    // Respect a user's native unhide action: relinquish our marker before the
    // host changes and saves the message so a later hide remains theirs.
    const nativeUnhide = event => {
        const control = event.target?.closest?.('#chat .mes_unhide'), row = control?.closest('.mes');
        if (!row) return;
        const index = Number(row.getAttribute('mesid')), message = getContext().chat?.[index];
        if (Number.isInteger(index) && message?.extra?.lunarSummaryGhost === true) { delete message.extra.lunarSummaryGhost; queueMicrotask(updateMeter); }
    };
    document.addEventListener('click', nativeUnhide, true);
    switchChat();
    return () => {
        disposed = true; epoch++; pending?.abort(); clearTimeout(autoTimer);
        for (const [name, listener] of listeners) (source?.removeListener || source?.off)?.call(source, name, listener);
        document.removeEventListener('click', nativeUnhide, true);
        try { getContext().setExtensionPrompt?.(PROMPT_KEY, '', 1, settings.depth, false, 0); } catch { /* Host cleanup must not break other modules. */ }
        drawer.drawer.remove();
    };
}
