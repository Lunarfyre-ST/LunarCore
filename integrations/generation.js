// Read only the documented generation type and boolean flags. Never copy the
// options object: it can contain prompts, names, image URLs and abort signals.
export function connectGeneration(api, context) {
    const source = context.eventSource, types = context.eventTypes || context.event_types || {};
    const remove = source?.removeListener || source?.off;
    const supported = Boolean(source?.on && remove);
    api.emit('host.generation_coverage', {
        startAvailable: supported && Boolean(types.GENERATION_STARTED),
        endAvailable: supported && Boolean(types.GENERATION_ENDED),
        stopAvailable: supported && Boolean(types.GENERATION_STOPPED),
        afterCommandsAvailable: supported && Boolean(types.GENERATION_AFTER_COMMANDS),
    });
    let pending = null, ambiguous = false;
    const cleanups = [];
    const listen = (name, handler) => {
        if (!supported || !types[name]) return;
        source.on(types[name], handler); cleanups.push(() => remove.call(source, types[name], handler));
    };
    const metadata = (type, options, dryRun) => ({
        generationType: type === undefined || type === '' ? 'normal' : ['normal', 'quiet', 'impersonate', 'regenerate', 'swipe', 'continue'].includes(type) ? type : 'other',
        dryRun: dryRun === true, dryRunKnown: typeof dryRun === 'boolean',
        ...(typeof options?.automatic_trigger === 'boolean' ? { automatic: options.automatic_trigger } : {}),
    });
    function close(outcome, reason) { pending?.finish({ outcome, reason }); pending = null; }
    listen('GENERATION_STARTED', (type, options, dryRun) => {
        const fields = metadata(type, options, dryRun);
        api.emit('host.generation_started', fields);
        if (fields.dryRun) { api.emit('generation.lifecycle', { ...fields, outcome: 'skipped', reason: 'dry_run' }); return; }
        ambiguous = Boolean(pending) || ambiguous;
        if (pending) close('unobserved', 'overlapping_start');
        pending = api.begin('generation.lifecycle', fields);
    });
    listen('GENERATION_AFTER_COMMANDS', (type, options, dryRun) => {
        const fields = metadata(type, options, dryRun);
        api.emit('host.generation_after_commands', fields);
        if (!fields.dryRun) pending?.step({ stage: 'after_commands' });
    });
    for (const [name, event, outcome, reason] of [
        ['GENERATION_ENDED', 'host.generation_ended', 'completed', 'end_event'],
        ['GENERATION_STOPPED', 'host.generation_stopped', 'cancelled', 'stop_event'],
    ]) listen(name, () => {
        api.emit(event);
        close(ambiguous ? 'unobserved' : outcome, ambiguous ? 'ambiguous_terminal' : reason);
        ambiguous = false;
    });
    for (const name of ['CHAT_CHANGED', 'GROUP_CHAT_CHANGED']) listen(name, () => {
        if (pending) { close('unobserved', 'chat_changed'); ambiguous = true; }
    });
    return {
        report() { pending?.step({ stage: 'completion_not_observed', outcome: 'pending', reason: 'recording_exported' }); },
        dispose(discard = false) {
            for (const cleanup of cleanups) cleanup();
            if (!discard) close('unobserved', 'recording_stopped');
            pending = null;
        },
    };
}
