# v0.0.6

Adds the optional Moonlight Blue recolor under LunarCore → LunarUI: cool blue
panel tints, accents and a soft glow. It starts disabled and remembers the user's
choice through SillyTavern settings. Disabling it removes the CSS layer and
restores the current underlying theme without rewriting native theme settings.
Layouts, images, backgrounds and scene behavior are unchanged.

LunarDebug records only the fixed preset identifier and enabled state at recording
start and on changes. Export schema remains 4 and producer protocol remains 1.
No companion ImmersiveGroups update is required.

## Debug additions

- Optional local auto-save, with five browser-local recordings up to 2 MB each,
  routine/error checkpoints, and an Open logs folder archive with export/delete.
- All eight IG motion configuration snapshots and changes, including fractional
  strengths, plus anonymous native sprite loading/source/visibility observations.
- Companion IG motion hooks report job starts, completions, cancellations, API
  failures, entrance load waits and restart notifications. These detailed motion
  traces require the updated IG copy; archive and DOM observations do not.

Schema remains 4 and producer protocol remains 1. Auto-save starts off. The
browser archive survives reload but can be cleared/evicted; abrupt shutdown can
lose the latest checkpoint. No network upload or OS folder access is added.
