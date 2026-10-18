# v0.0.2

Expands LunarDebug from an event timeline to named UI actions, safe initial
configuration and setting differences. Repetitive layout notifications, slider
changes and menu scrolling are summarized to reduce noise. Synchronously started
operations can reference the initiating UI action through `causeOperation`.

Exports use schema version 2; producer protocol remains version 1. Content,
private identifiers, filenames, URLs, credentials and raw errors remain excluded.
The panel highlights installations without detailed ImmersiveGroups producer
hooks. UI/configuration capture does not require those hooks.
