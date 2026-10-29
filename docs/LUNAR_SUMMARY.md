# LunarSummary v0.1.0

LunarSummary keeps separate chronological summary blocks in each chat. A block
covers the next unsummarized conversation messages (default 10, adjustable 1–100)
and is shown with its original one-based message range. Message ranges refer to
SillyTavern message positions, not pairs of user/assistant turns. Delete a block
with its × button to release its message coverage and restore its ghosted messages.
Existing v0.1.0 single summaries are retained as an earlier-summary block.

Generate draft sends the chosen messages and speaker names to the current main
API or a connection profile. Review it and save the block. Automatic mode is off
by default; when enabled, it sends and saves a block after a full batch of new
messages, waiting for the group round to end. Summarize through a message number
runs sequential batches through that point, including a final partial batch, and
saves them without individual review. Summarize all complete missing blocks
processes uncovered messages through the chat position at the time it is clicked,
using the current block size; a partial final block is left for later. It also
saves each block without individual review. Each request may incur cost. One request is
active at a time. Cancel, a chat switch or an ordinary chat generation discards a
pending result; main API requests may continue and incur cost after cancellation.

The default prompt asks for two or three concise sentences without lists or
headings. Provider output can still vary. Existing custom instructions and saved
summaries are preserved; reset instructions to use the current default.

Enable summary injection before opting into Ghost summarized messages. Ghosting
uses SillyTavern's native is_system flag to exclude those messages from its prompt
while leaving them visible. LunarSummary marks only its own changed messages.
Unhide LunarSummary messages restores those messages and keeps the summary blocks;
this can make both original messages and summaries appear in the prompt. Delete a
block to restore and make its messages eligible for summarizing again. The native
hidden/system message count includes true system messages, while the separate
LunarSummary count shows its own ghosted messages. Native user-unhide actions give
up LunarSummary's ghost ownership. Native edits, deletions and swipes observed by
LunarSummary mark affected blocks as needing review, remove them from injection,
and unhide their remaining messages. Delete a stale block and regenerate it.
Changes made while the extension is absent may not be detected; restore ghosted
messages before disabling/uninstalling it. Changes by other extensions to native
hidden flags can affect ownership and should be checked before unhide.
On chat load, if summary injection is off or the host prompt hook is unavailable,
LunarSummary restores its own ghosted messages and requests a chat save so their
contents remain available to the prompt.

Injection is off by default. Enable it to add the saved non-stale blocks as a
system message at a chosen in-chat depth (including zero) or at the host's
above-history position. Other summaries and ImmersiveGroups' scene prompt remain
independent; using more than one may duplicate information or use extra tokens.
Output can be inaccurate; review it before using it as story continuity. This
extension does not change any other extension's prompt settings.

The top context meter counts current non-system message text and the enabled
LunarSummary injection using the host tokenizer when available, or a rough
four-characters-per-token fallback. It compares this partial count with the host's
configured context maximum. It does not include cards, lore, other extensions,
formatting, output reserve or actual context trimming, and is not the complete
prompt. Summary tokens count active non-stale block text even if injection is off.

Summaries and ownership markers are stored in chat data and can appear in exports
and backups. No chat contents are sent to LunarDebug. The host save API can swallow
storage errors, so a returned save is not a durability guarantee. Unsaved drafts
are lost on chat switch/reload. The default API can lack truncation metadata, and
response length cannot always be verified. No custom endpoint/API key field is
implemented; use a SillyTavern connection profile for a separate provider.

The implementation uses native prompt and request APIs reviewed at SillyTavern
commit 06bde939f. Tests use disposable Chromium fixtures; they are not live-server
or actual-provider verification.
