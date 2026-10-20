# Recording analysis notes

## Recording (4), analyzed 2026-10-19

- LunarCore 0.0.7 / ImmersiveGroups 0.3.6; schema 4, active at export.
- Main buffer: 193 retained, 0 dropped, 24 summarized. Attention: 41 retained,
  0 dropped. Shared events/attention entries counted once by sequence.
- All 41 attention observations are `sprite.lifecycle` / `load_error` for the
  same recording-local operation 1: solo renderer, invisible, image not ready.
  Errors recur roughly every two seconds. This is not 41 independent bugs.
- Operation 1 later ends as removed/completed. Separate operation 2 reports
  loaded, visible and ready; it does not prove operation 1 recovered.
- Current producer observes image error events. Cause and asset identity are
  unknown. No recorded ancestry establishes a connection to LunarUI.
- Suggested owner follow-up: summarize repeated hidden sprite errors with
  occurrence counts and first/last relative timing, retaining visibility and
  source-change boundaries. Distinguish hidden load observations from visible
  sprite failures without collecting source identities or raw errors.
- Sent to the responsible ImmersiveGroups worker. No recorder changes made here.

## Recording (5), analyzed 2026-10-19 — ImmersiveGroups context

- LunarCore 0.0.7 / ImmersiveGroups 0.3.7; schema 4 / protocol 1. Live export,
  258 retained main records, 0 dropped, 4 summarized; 40 attention observations
  retained, 0 dropped. Deduplicated shared event/attention rows by sequence.
- All 40 failures are actual observed image error events for recording-local
  sprite operation 1: solo renderer, invisible, imageReady false. First/last
  errors are at 514 / 78631 ms, generally about two seconds apart. They describe
  repeated observations of one image DOM lifetime, not 40 independent bugs.
- Chat change occurs at 78605 ms: 39 errors precede it, one follows 26 ms later.
  Operation 1 ends removed/completed at 79192 ms. Separate operation 5 is visible
  and ready at 78974 ms and reports loaded. This supports pre-chat hidden-image
  activity stopping around chat load, but does not establish the asset identity,
  request cause, an exact no-chat state, or recovery of the old image itself.
- No runtime.error/unhandled_rejection records appear. Background pan restarts
  near the chat change, and breathing starts after the visible image is ready.
  The recorded generation is a dry run, skipped as expected. Live loops need not
  have terminal records at export. No recorded ancestry attributes this to LunarUI.
- Coverage caveat: this export has neither motion.coverage nor sprite.inventory,
  no nativeTransition field, and hidden errors remain individual detail records.
  Current checkout includes those fields/events and hidden-error grouping. That
  strongly suggests an earlier/cached/mixed installed recorder copy; the version
  label alone cannot identify installed source. It does not prove a deployment
  cause or a failure of the latest grouping implementation.
- Next check: update the installed LunarCore copy and reload the browser, then
  capture startup through chat loading again. Verify coverage/inventory records
  and hidden-error count/first-last timing. Keep source/visibility boundaries;
  do not suppress every hidden-image failure or claim a network cause. If the
  repeated errors persist with current coverage, investigate native placeholder
  image initialization locally without exporting paths, names or raw errors.
- Shared practice: read this file before analyzing future recordings and append
  findings from either repository context. IG AGENTS.md now references this file.
  Analysis/documentation only in this turn; no runtime behavior changed.

## Recording (6), analyzed 2026-10-19 — ImmersiveGroups context

- LunarCore 0.0.7 / ImmersiveGroups 0.3.7; schema 4 / protocol 1. Live export,
  108 main records, 0 dropped, 40 summarized; 41 attention observations in one
  retained attention record, 0 attention records dropped. Matching sequence 106
  in events/attentionEvents is one record, not two independent issues.
- Updated diagnostics are confirmed: motion.coverage reports motionHooks true
  and spriteObserver true. sprite.inventory reports one image, zero visible,
  zero ready, zero in native transition. nativeTransition fields are present.
- One sprite operation (1), solo renderer, invisible/unready, nativeTransition
  false, reports 41 load errors grouped into one summary. First observation is
  at 1539 ms and last at 81594 ms, about two seconds between occurrences. This
  confirms hidden-error grouping works; attentionCount remains an observation
  count and intentionally does not become a count of unique bugs.
- No chat-change event, visible ready image, sprite removal, or animation jobs
  are recorded in this capture. The image remains hidden/unready through the
  available observations. Do not infer a loaded chat or visible character failure.
  Source identity and native request cause are unknown; there is no evidence
  attributing these errors to LunarUI or a specific asset.
- This resolves the previous uncertainty about whether the installed recorder
  contains the latest coverage/grouping additions. Grouping reduces noise; it
  does not fix the underlying image-error source. If investigating that source,
  reproduce native placeholder initialization before chat selection, preserving
  error visibility and source-change boundaries without collecting private paths.
- Shared notes updated; analysis only, no runtime changes or tests required.

## Recording (7), analyzed 2026-10-20 — ImmersiveGroups context

- LunarCore 0.0.7 / ImmersiveGroups 0.3.8; schema 4 / protocol 1. Live
  export: 1331 main records, 0 dropped, 106 summarized; 30 attention
  observations in 26 retained attention records, 0 attention records dropped.
  Deduplicate events/attentionEvents by sequence; these are shared observations.
- All 30 attention observations are sprite.lifecycle load_error, failed/error,
  invisible and unready. Five repeats belong to one hidden solo image operation,
  nativeTransition false, grouped from 247 to 182681 ms. This resembles the
  previously observed hidden solo-image pattern; source identity remains unknown.
- The other 25 observations belong to 25 desktop image operations with
  nativeTransition true, from 4342 to 222789 ms. Every affected operation has
  observed/load_error/removed stages; none records loaded, visible or ready.
  This adds a native-transition pattern beyond the earlier solo-only captures.
- Native-transition metadata describes the holder state; it does not prove which
  transition image was intended for display. Temporary placeholder/clone image
  initialization is a hypothesis to investigate, not a confirmed cause. The
  recording contains no asset source or HTTP status and cannot identify a
  missing file, attribute responsibility, or establish that failures are harmless.
- No other failed outcomes or error-named events appear in the retained events.
  Final inventory at 695328 ms reports 4 images, 3 visible, 3 ready and 0 in native
  transition. This is aggregate state, not recovery of the failed image operations
  or proof that no visual glitches occurred. Cancellation count 267 is separate
  from attention count and must not be added to the 30 errors.
- Next check: reproduce native expression replacement locally and inspect hidden
  image/clone initialization and request failures without exporting private asset
  identifiers. Preserve actual image-error reporting rather than suppressing all
  hidden-image failures. Analysis/documentation only; no runtime changes or tests.
## Recording (8), analyzed 2026-10-20 — LunarUI drawer positioning

- Schema 4 / protocol 1; LunarCore 0.0.8 / ImmersiveGroups 0.3.8.
  Live export: 141 main records, capacity 50000, 0 dropped, 41 summarized;
  3 attention observations grouped into 1 retained record, 0 attention dropped.
  Deduplicated the shared events/attentionEvents by sequence.
- Integration reports instrumented/ready; motionHooks and spriteObserver true.
  Start/end/stop/after-command generation event definitions are available; this
  does not guarantee all lifecycle notifications are delivered.
- All attention is sequence 109: sprite.lifecycle/load_error, operation 1,
  invisible/unready solo renderer, nativeTransition false, count 3, from 1228 to
  3956 ms. No source identity or request cause is recorded. Existing grouping is
  working; this is not three separate bugs or evidence of a UI positioning cause.
- Eight cancellation records are separate from attention. The generation record
  is a dry run skipped as dry_run, not proof of a missing response. The user
  clarified the blank chat in the screenshot was an empty conversation.
- The exported metadata does not contain CSS geometry or current LunarUI preset/
  area controls. ui.theme/moonlight_blue disabled does not identify which other
  preset or effect settings were active. Do not infer CSS causation from timing.
- Independently reproduced the reported dropdown displacement in the local UI
  fixture: raising static toolbar wrappers with position:relative changed the
  dropdown containing block (left 20 to 284 px; width 360 to 96 px). LunarUI now
  raises only drawer icons, preserving the native wrapper and anchor. This is a
  source/fixture finding, not a conclusion derived from the recording.
- Handoff: hidden solo-image errors remain the actionable recorder/source
  follow-up; retain counts/timing and privacy boundaries. No recorder schema
  expansion is needed to fix this LunarUI regression.
