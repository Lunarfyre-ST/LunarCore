# LunarCore v0.0.8

- Rename the displayed Moonlight Blue preset to Moonlight; keep legacy saved keys
  and the recorder contract intact.
- Add Starlight: darker blue-gray surfaces, 72% default opacity, dimmer text, and
  65% effect strength/speed while recoloring is active.
- Add per-preset text enable/reset and regular/emphasized/quoted color pickers.
- Strengthen default quote colors to distinguish dialogue from action text;
  migrate previous defaults once while preserving custom choices.
- Preserve native static toolbar wrappers when layering effects, fixing shifted
  dropdowns and their width; raise only drawer icons.
- Neutralize inactive native insets when adding a decoration anchor to a static
  element. This prevents ST's `#chat { bottom:10px }` from shifting chat upward
  and opening a gap above Quick Replies. Existing positioned elements retain
  their offsets; the separate viewport-bottom gap remains unattributed.
- While recoloring is enabled, hide the VN chat top border while keeping rounded corners
  and the native 1px composer margin, keeping welcome/chat joins consistent.
  Explicit composer tint/border styles also cover initial insertion, replacement,
  focus and blur without user actions. Keyboard focus indication remains visible.
  Turning recoloring off restores current native appearance and spacing.
- Place stars below native content and above normal surface/message backgrounds;
  use screen blending and pale cores without inherited shadows to avoid dark spots.
- Add experimental random positions with the same count, frequency and stagger.
- Replace the faint glow border with soft breathing bloom. Area bloom controls
  clearly require the global Soft bloom toggle.

Validated with Node 24 syntax/version checks, unit tests, isolated UI and shared
IG/recorder browser fixtures. Mobile checks use Chromium at a narrow viewport;
real iOS/Safari/Android rendering and custom themes still require live validation.
Recorder schema/protocol are unchanged; recorder maintenance remains with its owner.
