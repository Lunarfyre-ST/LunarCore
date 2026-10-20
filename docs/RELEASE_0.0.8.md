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
- Place stars below native content and above normal surface/message backgrounds;
  use screen blending and pale cores without inherited shadows to avoid dark spots.
- Add experimental random positions with the same count, frequency and stagger.
- Replace the faint glow border with soft breathing bloom. Area bloom controls
  clearly require the global Soft bloom toggle.

Validated with Node 24 syntax/version checks, unit tests, isolated UI and shared
IG/recorder browser fixtures. Mobile checks use Chromium at a narrow viewport;
real iOS/Safari/Android rendering and custom themes still require live validation.
Recorder schema/protocol are unchanged; recorder maintenance remains with its owner.
