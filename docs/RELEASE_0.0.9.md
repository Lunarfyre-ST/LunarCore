# LunarCore v0.0.9 — presets and extension boundaries

- Add eight saved custom appearance presets: palette, text, opacity, effect
  switches, strengths, density and timing. Load/reset/delete saved copies and
  import/export validated versioned preset JSON (64 KB limit).
- Add a normal/action/quote text preview, collapsed advanced area controls,
  area reset, preset reset and a single disable-all control.
- Add per-area star density (0–200%) and separate global twinkle frequency from
  sweep/bloom speed. Existing speed choices migrate to the initial frequency;
  existing animation defaults and master switches are preserved.
- Add a simpler touch rendering path: white gradient stars and position-driven
  sweeps avoid combined animated transforms/clipping/blending. Observe the actual
  chat viewport for visibility, including when an extension positions it outside
  the outer Sheld wrapper. Keep timing, density and random cycles unchanged.
- Add `data-lunar-ui="off|colors|effects"` subtree boundaries for extensions,
  including live changes, native root palette restoration and ancestor effect
  clipping. See LUNAR_UI_INTEGRATION.md for syntax, examples and limits.
- Retain the v0.0.8 native layout behavior and the confirmed 10px shift fix.
  Native rounding/borders and the native 1px composer margin are not overridden.
  No return of the reverted border/composer styling experiments.
- Preserve LunarDebug preferences and producer/export contracts. UI preset files
  are separate from recordings; they include only validated appearance settings
  and the user-chosen preset name.

Validation uses Node 24 unit/syntax/version checks and disposable Chromium UI
and companion IG/recorder browser fixtures. Coverage includes custom presets,
imports, density/timing, reduced motion, visibility, native dropdown anchors,
chat/control resizing, opt-out toggles, touch-device raster brightness and cleanup.
Mobile Chromium emulation is not live Samsung Internet/Android/iOS or
real-SillyTavern validation. A live desktop/mobile smoke
check with the installed ST/IG versions and the user's theme remains required.
