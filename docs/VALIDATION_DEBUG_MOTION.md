# Motion diagnostics and local archive validation

Checked LunarCore 0.0.6 and companion ImmersiveGroups 0.3.6 using Node 24.

- LunarCore Node regressions: 23 pass, including typed motion settings, privacy,
  operation session guards, save throttling/session rotation, unavailable storage
  and oversize refusal. Syntax/metadata checks pass.
- LunarCore targeted Chromium debug fixture suite (`LUNAR_DEBUG_ONLY=1`): motion producer traces, anonymous source/load/
  visibility/removal observations, error checkpointing, archive recovery after
  reload, JSON export, deletion and five-log IndexedDB retention.
- ImmersiveGroups: lint, syntax/import/metadata checks and 146 Node tests pass.
  Focused motion browser suite passes in Chromium and Firefox, including absent,
  enabled, disabled, incompatible and throwing diagnostic consumers and unchanged
  saved scene data.

These are simulated native integrations, not a new real-SillyTavern or physical
phone validation. No claim is made that the reported unmute glitch is fixed.
No gallery source/build, native upload API or saved scene behavior changed.

For the next real-use capture, enable recording and local auto-save before
unmuting. Repeat a few times, wait a second after the glitch, then export the live
recording or recover it via Open logs folder after reload. Enable auto-start too
if future reload sessions should begin recording automatically. An old recording
already lost from memory cannot be recovered retroactively.

Inspect sprite lifecycle/source/load events alongside motion restart, entrance
wait and animation terminal records. Anonymous operations represent DOM lifetimes
or jobs, not named characters; timing alone does not prove cross-event identity.
Browser focus/visibility is not the active-renderer decision, and job completion
does not guarantee visually correct frames. Logs retain no asset/name identifiers.

The final full LunarCore browser run stopped at the existing Moonlight Blue quote-color assertion after concurrent LunarUI changes (expected #9dd5ff, actual #a2b5cd). The UI source and color expectation were left untouched; the debug suite runs independently. Earlier full runs passed before that concurrent change.
