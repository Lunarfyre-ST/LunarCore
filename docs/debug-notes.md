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
