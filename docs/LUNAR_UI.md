# LunarUI night profiles and idle effects

Open **LunarCore → LunarUI**. Recoloring and idle effects have separate enable
switches and start off on fresh installs. Existing enabled Moonlight choices are
preserved, without automatically enabling animation.

## Profiles

| Profile | Appearance | Default panel opacity |
| --- | --- | --- |
| Moonlight Blue | Muted blue accents and dark navy surfaces; softer surrounding tint and glow | 82% |
| Twilight | Dark indigo/purple accents with more transparent surfaces | 58% |

Panel opacity ranges from 20–100% and is remembered separately for each profile.
**Reset profile opacity** resets only the selected profile. Lower opacity reveals
more of the existing background; the background image itself is never changed.

The recolor layers CSS variables and chrome styles over the current native theme.
Switching it off removes that layer, revealing the current underlying theme,
including native theme changes made while the layer was active. It does not
rewrite native theme settings or change layouts, sprite positions or chat data.
Custom CSS can still override the pack's styles.

## Idle effects

- **Starlight twinkles:** small, staggered stars along header edges.
- **Shining sweeps:** occasional soft highlights passing across headers.
- **Breathing glow:** a slow change in a decorative border's opacity.

Intensity ranges from 0–100%; speed ranges from 0.25×–2×. At the default 0.75×,
cycles are about 13 seconds for twinkles, 24 for sweeps and 16 for breathing.
Sweeps remain idle during most of their cycle. These are independent of IG's
sprite/background animations and do not modify those preferences.

Decorative layers are restricted to extension settings headers and the profile
preview, at most 80 hosts with six decorative elements per host. They are inert,
hidden from assistive technology and ignore pointer input. No effect is placed
over chat text, input controls, images or sprites. Offscreen animations and hidden
tabs pause; reduced-motion preferences remove the layers. Disabling effects or
disposing LunarUI disconnects its observers/listeners and removes its decorations.

## Persistence and diagnostics ownership

Validated settings live in `extensionSettings.LunarCore.ui`: enabled/profile,
per-profile opacity and effect controls. Existing `moonlightBlue` preferences
migrate automatically, and the boolean remains synchronized for compatibility.
Other modules' settings, including the optional local log archive, are preserved.

LunarDebug's existing Moonlight-only preset event is preserved. Twilight names
and effect settings are not encoded into that old enum or added to recorder
schemas here; extending their diagnostic coverage belongs to the recorder owner.

## Verification

Use Node 24: `npm run check`, `npm test`, and `node tests/ui-browser.mjs` with
Playwright available. The UI browser fixture tests profile switching, independent
opacity, restoration, persistence, toggle/intensity/speed controls, dynamic headers,
reduced motion, page visibility, mobile overflow and disposal. Also run the shared
`tests/browser.mjs` when changing integration-facing UI behavior. Fixtures are
not a claim of validation against a live SillyTavern theme/profile.
