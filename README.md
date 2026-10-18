# LunarCore v0.0.3 — LunarDebug preview

LunarCore is a SillyTavern UI extension. Its first module is LunarDebug, an
optional recorder for real-use diagnostic metadata, especially ImmersiveGroups.

Install this repository through SillyTavern's extension installer, or place it
in your development installation's third-party extension directory. No build
or npm install is required for the extension itself.

Open **Extensions → LunarDebug**, enable **Record diagnostic metadata**, reproduce
the behavior, stop recording, then choose **Export JSON**. Recording starts off
unless you enable **Start recording automatically after reload**. Stop retains
the buffer; Clear erases it; page reload loses it. The default limit is 10,000
records, adjustable from 1,000 to 50,000 while recording. Shrinking keeps the
newest records and counts removed ones as discarded. This is a record count,
not a byte or file-size limit. Capacity and auto-start preferences are saved
through SillyTavern; recordings themselves are never persisted automatically.
Exports include the whole buffer regardless of the panel's event filter.

## Background use

Enable recording and optionally auto-start, then leave the panel closed while
using SillyTavern. Routine context injections, history cleanups, layout/scroll
activity, settings-update notifications and disabled-animation skips with
identical safe metadata are summarized even across interleaved events. Changes
and execution traces stay visible. This compares metadata, not private prompt
content; identical lengths do not prove identical text. A failure ends the
current summaries so activity before/after it stays separate.

The header shows observed attention records (failed outcomes, producer-reported
issues, and failed/partial/blocked integration status). Cancellations are counted
separately and are not automatically errors. The recorder also observes browser
errors and unhandled rejections, without messages, stacks, URLs or rejection
values; these can come from any extension. Caught failures with no producer hook
remain outside its coverage. There are no periodic popups or network uploads.

The newest 200 attention records are kept in a separate bounded history even
when the main buffer rolls over. Use **Attention records** in the filter to
inspect them. Both buffers and counters are reset by Clear. Exports include
both buffers and counts of discarded attention records.

## Recorded metadata

- Named menu/button actions using fixed product identifiers, never visible text.
- Initial allowlisted configuration and before/after setting changes, including
  separate desktop/mobile layout values, animation settings, and safe automation options.
- Layout notifications, repeated setting changes and menu scrolling summarized
  in 500 ms windows, with counts and activity duration. Export and Stop flush
  pending summaries; Clear discards them. Duration describes the activity window,
  not rendering cost or frame performance.

- SillyTavern chat, generation, group, message edit/swipe/delete and settings event occurrences.
- ImmersiveGroups readiness, layout, automation, background catalog and binding events;
  native background surface changes even when fades are disabled.
- With the companion ImmersiveGroups diagnostic hooks: outfit operations,
  background requests, animation lifecycle and timing, automation command
  outcomes, API request lifecycle, context injection length/depth and history-cleanup executions.

Detailed hooks are currently local changes in the sibling ImmersiveGroups repo;
both working copies must be used in the test SillyTavern installation. Existing
ImmersiveGroups releases provide basic events only. The panel reports which
mode is available. UI/configuration recording also works with older versions;
the panel highlights missing execution hooks. ImmersiveGroups remains usable
without LunarCore. Updating LunarCore alone does not add producer hooks to an
installed ImmersiveGroups release.

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
