# v0.0.3

- Summarizes repeated safe metadata for expected activity across interleaved events.
- Adds an adjustable 1,000–50,000 record buffer; shrinking keeps the newest records.
- Keeps the newest 200 attention records separately from the main rolling buffer.
- Adds an attention badge/filter and separate cancellation counts.
- Observes browser errors/rejections without collecting their private details.
- Offers opt-in auto-start after reload; saves preferences but never recordings.

Exports use schema 3 and retain producer protocol 1. Routine summaries have a
count and last occurrence time. Failure records are never coalesced. Existing
ImmersiveGroups hooks continue to work; no companion changes are required.
