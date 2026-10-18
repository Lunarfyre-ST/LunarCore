# LunarCore v0.0.1 — LunarDebug preview

LunarCore is a SillyTavern UI extension. Its first module is LunarDebug, an
optional recorder for real-use diagnostic metadata, especially ImmersiveGroups.

Install this repository through SillyTavern's extension installer, or place it
in your development installation's third-party extension directory. No build
or npm install is required for the extension itself.

Open **Extensions → LunarDebug**, enable **Record diagnostic metadata**, reproduce
the behavior, stop recording, then choose **Export JSON**. Recordings are off
after every reload. Stop retains the buffer; Clear erases it; page reload loses
it. At most 10,000 records are retained, with discarded record counts in exports.
Exports include the whole buffer regardless of the panel's event filter.

## Recorded metadata

- SillyTavern chat, generation, group, message edit/swipe/delete and settings event occurrences.
- ImmersiveGroups readiness, layout, automation, background catalog and binding events;
  native background surface changes even when fades are disabled.
- With the companion ImmersiveGroups diagnostic hooks: outfit operations,
  background requests, animation lifecycle and timing, automation command
  outcomes, API request lifecycle, context injection length/depth and history-cleanup executions.

Detailed hooks are currently local changes in the sibling ImmersiveGroups repo;
both working copies must be used in the test SillyTavern installation. Existing
ImmersiveGroups releases provide basic events only. The panel reports which
mode is available. ImmersiveGroups remains usable without LunarCore.

## Privacy and limits

Only explicitly allowed event names, enum values, bounded numbers and booleans
are recorded. No chat/prompt bodies, character or user names, avatar IDs,
outfit/background filenames, paths, URLs, credentials, error text, raw settings,
DOM content, hashes, absolute timestamps, or browser identifiers are accepted.
Operation IDs are local counters. This also means recordings cannot identify
which character or asset was involved. Timing and counts still reveal activity;
review an export before sharing it. Nothing is uploaded automatically.

This is an application recorder, not a JavaScript debugger or network capture.
It cannot observe arbitrary extension internals, the server, or model reasoning.
Events describe their actual boundary: a background selection request does not
prove that the native handler applied it. An outfit commit is recorded separately
from animation completion. A recording can end with unfinished operations if
you stop or clear it while work is in flight. It never replays actions.

## Development

Use Node 24: `npm run check` and `npm test`. Browser regressions can be run with
`node tests/browser.mjs` when Playwright is available (set `LUNAR_PLAYWRIGHT` to
its absolute `index.mjs` path if it is not installed locally). These tests use
the sibling ImmersiveGroups source; override it with `IG_SOURCE_ROOT` if needed.
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chrome executable
when Playwright's bundled Chromium is unavailable.

See [the protocol](docs/diagnostics.md) for integration details.
