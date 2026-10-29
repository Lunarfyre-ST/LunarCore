# LunarCore v0.1.0

- Add experimental LunarSummary with manual generation, editable drafts and
  explicit per-chat metadata saving. No automatic calls or chat-message edits.
- Use SillyTavern's main API or a connection profile. The provider receives the
  selected recent messages and speaker names. An optional, off-by-default prompt
  injection uses the saved summary at a configurable depth.
- Discard late results after cancellation, chat changes, selected-message edits,
  swipes, additions or draft edits. Profile calls receive an abort signal; main API
  calls can continue until the host returns. A pending call blocks another one.
- Preserve LunarUI, LunarDebug and ImmersiveGroups' independent settings and
  producer contract. See LUNAR_SUMMARY.md for privacy, save and version limits.

Validation covers model and disposable browser fixtures, shared recorder/IG
integration and LunarUI. The host API was reviewed at ST commit 06bde939f;
there has been no live SillyTavern server or provider validation yet.
