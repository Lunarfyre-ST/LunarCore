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

- **Starlight twinkles:** staggered stars across larger surfaces, with edge stars on headers.
- **Shining sweeps:** occasional soft highlights across the chat window; headers and other chrome use edge highlights.
- **Breathing glow:** a slow change in a decorative border's opacity.

Intensity ranges from 0–100%; speed ranges from 0.25×–2×. At the default 0.75×,
cycles are about 13 seconds for twinkles, 24 for sweeps and 16 for breathing.
Sweeps remain idle during most of their cycle. These are independent of IG's
sprite/background animations and do not modify those preferences.

Area tuning covers Chat / Sheld, the message composer, navigation, side panels,
dialogs and settings headers. Each has an enable switch, independent twinkle,
sweep and glow strengths (0–100%), and a speed multiplier (0.25–2×). Strengths
multiply global intensity before a square-root brightness curve, so low settings
remain visible; zero disables that effect locally. Speeds multiply global speed.
Chat twinkles default to 25% of global strength, composer to 35%.
The master switch and global effect switches apply to every area.

Surface selectors and defaults live in `modules/ui/areas.js`. Chat, composer,
navigation and panels use frames inside their native chrome containers, keeping
them in the native stacking and blur contexts. Chat uses `#sheld` and composer
uses `#form_sheld`; generic fixtures without those wrappers use external fixed
frames. Sheld decorations follow the visible `#chat` viewport, excluding IG
controls above it and the composer below it. Its sweep spans that viewport's
height; other chrome sweeps are masked to edges. No children are added to the chat list or
send form. Large surfaces have 16 stars distributed through their interior and
edges, composer has eight, and headers/navigation have four. Stars have a brighter
core; low strength no longer multiplies down to nearly invisible opacity.
Dialogs and headers use inert local layers. At most 80 surfaces are decorated;
major surfaces precede headers. Pointer input and assistive technology ignore
these layers. Resize, scroll, panel changes and dragging refresh their geometry.
Hidden/offscreen animations pause; reduced motion removes layers. Disable and
dispose clean up decorations, observers and listeners. Custom themes or new host
surfaces may require additional explicit selectors; this does not theme sprites,
background images or every individual message/control.

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
