# Diagnostic protocol 1

The optional sink is `globalThis[Symbol.for('LunarDebug.sink')]`. Check
`protocol === 1` and `enabled` before emitting. Producers must catch consumer
errors and never change application behavior because diagnostics fail.

`emit(event, fields)` records an instantaneous occurrence. `begin(event, fields)`
returns an operation with `step(fields)` and `finish(fields)`; it can return null
when recording is disabled. Finishing is idempotent. Operations begun before
Stop or Clear cannot write into a later recording session.

The schema and allowlists are in `core/diagnostics.js`. Do not add free-form
fields, deterministic hashes or private identifiers. Extend enums explicitly
when more detail is needed. Retain relative timing and local operation counters.

Exports use `schema: lunar-debug-recording` and `protocolVersion: 1`.
Exports from v0.0.2 use `schemaVersion: 2`, adding typed
configuration fields, UI actions, summaries and optional `causeOperation`.
The ring buffer can evict an operation's start while
retaining its end. Analysis must tolerate incomplete operations and inspect
`dropped`. Only explicit `causeOperation` links imply ancestry. They link operations
started during the same UI event dispatch to that action. Work started after an
await is not automatically attributed; closeness in time does not prove causation.

`ui.action` uses fixed identifiers from `core/settings-schema.js`. Setting values
are validated against the selected setting's type, numeric range or enum. There
are no arbitrary string setting values. Snapshot values reflect stored settings;
missing or invalid values are omitted rather than guessed from UI defaults.

`ig.layout`, `ig.editor_layout`, `ui.scroll` and repeated setting changes are
summarized in fixed 500 ms windows. `count` counts notifications/observed changes,
not necessarily distinct user actions. Setting summaries retain the first
`before` and latest `after`; intermediate values are intentionally omitted.
Summary duration measures first-to-last activity, not execution cost.

The recorder observes host events without reading their arguments. Detailed IG
events come from optional producer hooks rather than interception of fetch,
console, prompt functions or DOM text. It does not take scene/settings dumps.
