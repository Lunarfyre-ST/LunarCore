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

## Schema 3 / v0.0.3

Routine instantaneous records with identical safe metadata may become `phase:
summary`, retaining their first `elapsedMs` and updating `lastElapsedMs` and
`count`. Their sequence remains the first occurrence's sequence. Summaries can
span intervening events and do not imply continuous execution or identical
private content.
When producers supply batch `durationMs`, summaries sum those supplied durations;
`lastElapsedMs - elapsedMs` describes the span between observed records. Neither
measures rendering cost. A summary drops its single-action cause link. Changed metadata,
failures, Stop, Clear, and eviction break the relevant summary. Resize also resets
summary references. Producer operation start/detail/end records stay distinct.

`summarized` counts coalesced notifications; `dropped` counts evicted records.
`attentionCount` counts attention records observed since Clear (not unique bugs).
`cancelledCount` counts cancellations separately. `attentionEvents` retains the
newest 200 attention records; `attentionDropped` tracks its evictions. A record
may appear in both arrays with the same sequence; deduplicate by sequence when
combining them. Runtime-error records intentionally do not identify their source.

Capacity is bounded to 50,000 main records plus 200 attention records. UI minimum
is 1,000. Resize preserves active operations and newest records. No recording
data is saved automatically, including when auto-start is enabled.

## Schema 4 / v0.0.4

`generation.lifecycle` operations observe host execution: `generationType`,
`dryRun`, `dryRunKnown`, and optional `automatic` are read explicitly. Options
objects and terminal payloads are never copied. `host.generation_coverage` records
which event definitions can be subscribed to, not a promise that they fire for
every start. Dry runs are skipped, not tracked as missing network requests.

Normal end/stop events close the pending observation. Overlapping starts and
post-chat-switch terminals are ambiguous because host events have no request ID.
They produce `outcome: unobserved`, as does stopping the recorder while a start
remains unmatched. This is not an attention/failure classification. Active export
adds a pending observation rather than assuming a timeout or failure.

`ownership` identifies `shared`, `explicit` and `inherited` setting values;
`beforeOwnership` preserves the initial ownership through an aggregated change.
Ownership changes are recorded even if the effective value stays the same.

Operation `run(callback)` propagates an explicit parent operation context through
a producer-chosen callback. The callback always runs, even if recording stopped;
stale sessions do not add links. Updated IG hooks associate a native background
selection with its already-queued style observer; the association expires after
that microtask, so unrelated future changes cannot inherit it. `causeOperation`
can refer to either a UI action or an explicit parent producer operation.

Cancellation reasons are emitted where cancellation occurs: superseded, chat,
layout, viewport, motion preference or scene disable changes; stale results;
unknown when the producer has no explicit reason. Similar timing alone never
sets a reason. Product setting/state names are allowed; raw text and private
identifiers are still rejected at the sink.

`ui.theme` records the fixed preset identifier `moonlight_blue` and a boolean
`enabled` at recording start and on toggle changes. It contains no native theme
dump or custom CSS. This additive metadata keeps export schema 4/protocol 1.
