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
