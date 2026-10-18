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

Exports use `schema: lunar-debug-recording`, `schemaVersion: 1` and
`protocolVersion: 1`. The ring buffer can evict an operation's start while
retaining its end. Analysis must tolerate incomplete operations and inspect
`dropped`. No ancestry between separate operation IDs is implied.

The recorder observes host events without reading their arguments. Detailed IG
events come from optional producer hooks rather than interception of fetch,
console, prompt functions or DOM text. It does not take scene/settings dumps.
