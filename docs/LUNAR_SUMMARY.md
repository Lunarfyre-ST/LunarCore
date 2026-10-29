# LunarSummary v0.1.0

This first iteration creates a manually reviewed summary of the most recent 1–100
non-system, nonempty messages, with a 120,000-character request limit. It sends
the selected message text, speaker names and instructions only when you click
Generate draft. Select the current main API or a saved SillyTavern connection
profile; profile requests do not switch the active profile. The provider receives
the conversation and can charge for the request. No custom endpoint or separate
API-key field is implemented. No chat content is sent to LunarDebug.

Review/edit the draft and click Save to store it in the current chat metadata.
Chat exports and backups can contain the summary. SillyTavern's save API can
swallow storage errors, so a completed save request is not a durability guarantee.
Unsaved drafts are lost on chat switch or reload. The saved summary is independent
of SillyTavern's built-in summary and other extensions. The next generation starts
from the selected recent messages, not the previous summary; this is not yet an
incremental or automatic memory system. Stored summaries do not rewind on edits,
deletions or swipes; regenerate/review them when the conversation changes.

Optionally enable injection to insert the saved summary as an in-chat system
message at the chosen depth, including depth 0, or above the chat history in the
host's in-prompt position, through a unique extension prompt key. Injection is
off by default, follows the current chat, and is cleared on disable/disposal.
It can coexist with ImmersiveGroups' independent scene prompt and other summary
extensions; enabling multiple summaries can duplicate information or use tokens.
Check generated text for errors before saving and injecting it.

The context meter counts the currently visible-to-prompt message text and enabled
summary with the host tokenizer when available, otherwise approximately four
characters per token. It compares that partial count with the configured maximum;
character cards, world information, other extensions, formatting, output reserve,
and actual context trimming are not counted. It is not a total prompt meter.

Changing chats, settings or cancelling discards any in-flight result. Changes to
the selected messages or draft also invalidate it. Profile requests receive an
abort signal; SillyTavern's current main API method does not accept one, so its
request can continue and incur cost after cancellation. Only one summary request
is allowed at a time until its underlying call settles. Wait for the summary call
to finish before starting chat generation; starting a non-quiet chat generation
discards the pending result, but may overlap the underlying main API request.
Some host API paths return only text without finish reasons, so a truncated
response cannot always be detected automatically. No automatic requests,
history mutation, private diagnostic events or API credentials are added.

ImmersiveGroups uses the same public prompt hook for scene context and the same
main/profile request APIs for scene analysis, but LunarSummary imports none of
its internals. Its prompt may see scene-command lines within message text and
asks the model to ignore them; this is not a guaranteed parser. The implementation
was checked against SillyTavern source at commit 06bde939f and simulated browser
fixtures, not a live server or every provider.
