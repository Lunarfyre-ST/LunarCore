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
data is saved automatically unless local auto-save is separately enabled;
auto-start alone does not enable persistence.

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

## Motion and sprite coverage

The motion diagnostic additions retain schema 4 and producer protocol 1.
Typed snapshots/diffs include the eight IG motion settings, including fractional
strength, style, direction and breathing scope. Missing values are not defaults.
`animation.motion` records actual WAAPI job starts and terminal outcomes with a
fixed `effect`, `preview` and `loop`. `finished` means that the job reached its
completion check, not proof of a correct-looking frame. Loops normally remain
open until cancelled. CSS speaker focus is covered by settings, not job traces.
`motion.lifecycle` reports entrance load waits, stale entrance checks and restart
notifications. A restart does not establish that an entrance replayed. Older IG
copies can provide settings and sprite observations without these producer hooks.

`sprite.lifecycle` observes each matching native sprite image DOM lifetime using
only recorder-generated operation counters. It records source-change booleans,
load/error events, visibility and image readiness, and ends on removal or recorder
detach. It never exports the source, character identity or DOM ID. A new source
can reuse a DOM node; an operation is not a character identity. Visibility means
DOM geometry/style visibility, not active-renderer eligibility or image opacity.
No source change means no observed `src` attribute change, not proof of no network
reload. Cached images may already be ready when recording begins. Missing load
completion at export is pending evidence, not a guessed failure.

For unmute/entrance glitches, record before unmuting, wait for the issue, then
export. Compare sprite source/load/visibility transitions, motion restarts and
entrance job outcomes. Anonymous sprite and motion operations are separate;
nearby timing alone cannot establish that they belong to the same character.
No per-frame animation sampling or private asset correlation is collected.

## Optional local log archive

LunarDebug can automatically save sanitized recordings when the user enables
“Automatically save logs on this device.” It is off by default and does not
enable recording itself. Enable automatic recording too for future sessions.
IndexedDB retains the newest five recordings, each limited to 2 MB. Routine
checkpoints run every five seconds; attention changes checkpoint on the next
UI timer tick (normally within 500 ms). Stop, hiding the page and page exit also
request a checkpoint. Clear starts a new archive entry; it does not erase saved
logs. Turning auto-save off retains old entries. “Open logs folder” opens this
in-browser archive, with JSON export and individual deletion, not an OS folder.
No log is uploaded or synced; storage is specific to the browser and site origin.

Storage errors must not affect the recorder or scene. Report failures in the UI.
An abrupt crash/phone shutdown can lose the latest checkpoint, and browser
storage can be evicted or cleared. Export important recordings. No automatic
download, directory permission, server filesystem access, absolute timestamp or
character/asset identifier is added. This supersedes earlier memory-only wording
for users who explicitly enable local auto-save.
