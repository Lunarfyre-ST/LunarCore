# v0.0.4

- Records safe generation types, automatic flags and dry-run status; adds
  after-command stages and start/end/stop capability reporting.
- Labels missing or ambiguous terminal observations without assuming failure.
  Exporting in-flight work marks it pending; Stop marks its completion unobserved.
- Distinguishes shared settings, explicit profile values and inherited values.
- Captures background picker/library selections and previous/next navigation.
- Updated companion IG hooks record explicit animation cancellation reasons
  and link background selection operations to their deferred animation jobs.
- Retains the v0.0.3 theme-aware input contrast fix.

Exports use schema 4, producer protocol 1. Product setting names, configuration
values and execution states are recorded; API keys, personal/character names,
user input, prompts and model output remain excluded.

The new cancellation reasons and deferred background links require the updated
ImmersiveGroups working copy. No changes to gallery bundles or height features
are part of this release.

Generation observations follow host events rather than network interception.
SillyTavern emits starts before command handling and for dry runs; end events
are associated with its generation UI. Host starts and terminals do not carry a
stable request ID. Overlapping requests or a chat switch therefore make pairing
uncertain. See the [host generation implementation](https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js).
