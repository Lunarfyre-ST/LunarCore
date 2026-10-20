# LunarUI night profiles and idle effects

Open **LunarCore → LunarUI**. Recoloring and idle effects have separate enable
switches and start off on fresh installs. Existing enabled Moonlight choices are
preserved, without automatically enabling animation.

## Profiles

| Profile | Appearance | Default panel opacity |
| --- | --- | --- |
| Moonlight | Muted blue accents and dark navy surfaces; softer surrounding tint and glow | 82% |
| Twilight | Dark indigo/purple accents with more transparent surfaces | 58% |
| Starlight | Dim blue-gray accents, quieter text and darker surfaces | 72% |

Panel opacity ranges from 20–100% and is remembered separately for each profile.
**Reset profile opacity** resets only the selected profile. Lower opacity reveals
more of the existing background; the background image itself is never changed.

The recolor layers CSS variables and chrome styles over the current native theme.
Switching it off removes that layer, revealing the current underlying theme,
including native theme changes made while the layer was active. It does not
rewrite native theme settings, sprite positions or chat data.
Custom CSS can still override the pack's styles.

While recoloring is on, chat has explicit 20px rounded top corners in welcome
and VN modes, including after late native/theme resets, without the top
border line, and the composer has no 1px top margin. Its panel tint/border apply from
first insertion and remain consistent across focus/blur and chat replacement,
independently of idle effects. Native keyboard focus indication is kept, tinted
to the preset. Disabling recoloring restores the native border, margin
and composer colors, including current native inline styling.

Each preset has an independent **Recolor text** switch, color pickers for regular,
emphasized and quoted text, and a reset button. Disabling text recoloring keeps
native text colors while retaining the panel recolor. Validated six-digit hex
colors are saved per preset. Existing Moonlight preferences migrate unchanged.
Default quotes use clearer blue (Moonlight), lavender (Twilight) and soft blue
(Starlight), distinct from subdued action/emphasis colors. Previous default quote
colors migrate once; customized colors remain. Native toolbar drawer wrappers
retain their positioning so dropdowns keep their original anchor and width.

Starlight dims effect strength to 65% and multiplies speed by 0.65 while its
recolor is enabled. Global and area controls still apply. Recoloring off restores
the normal effect pace independently of the chosen preset.

## Idle effects

- **Starlight twinkles:** staggered stars across larger surfaces, with edge stars on headers.
- **Shining sweeps:** occasional soft highlights across the chat window; headers and other chrome use edge highlights.
- **Soft bloom:** a breathing, diffuse inset light with two soft radii, not a border. Enable Soft bloom before using the area bloom-strength slider; it is disabled when bloom is off.

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

**Random star positions (experimental)** starts off. It randomizes positions when
enabled and again at each star's animation cycle. It preserves star count, cycle
duration and stagger; ordinary settings updates do not reroll positions. Turning
it off restores the original pattern. Positions are transient and never recorded.

Surface selectors live in `modules/ui/areas.js`. Decorations sit above surface
backgrounds and below native content. In chat, the layer is inside `#chat`, with
native message text/media/actions raised above it; normal message backgrounds
remain below it. Message contents and inputs are never read, copied or wrapped.
Native positioning is preserved, and added classes/layers are removed on disable.
Stars use light-only screen blending with pale cores and no inherited dark shadow.
This prevents the blue star color from darkening lighter pixels on mobile.
Opaque or separately isolated content from custom themes may cover decorations;
LunarUI does not remove native backgrounds, blur filters or transforms.

Chat decorations exclude IG controls and the composer, and follow the viewport
while scrolling/resizing. Chat sweeps cross its full height; other chrome sweeps
stay on edges. Large surfaces have 16 stars, composer eight, headers/navigation
four. At most 80 surfaces are decorated. Layers are inert, hidden from assistive
technology and ignore pointer input. Offscreen/hidden animations pause; reduced
motion removes them. Disable/dispose removes observers, listeners and classes.

## Persistence and diagnostics ownership

Validated settings live in `extensionSettings.LunarCore.ui`: enabled/profile,
per-profile opacity and effect controls. Existing `moonlightBlue` preferences
migrate automatically, and the boolean remains synchronized for compatibility.
Other modules' settings, including the optional local log archive, are preserved.

LunarDebug's existing Moonlight-only preset event is preserved. Twilight/Starlight names
and effect settings are not encoded into that old enum or added to recorder
schemas here; extending their diagnostic coverage belongs to the recorder owner.

## Verification

Use Node 24: `npm run check`, `npm test`, and `node tests/ui-browser.mjs` with
Playwright available. The UI browser fixture tests profile switching, independent
opacity, restoration, persistence, toggle/intensity/speed controls, dynamic headers,
reduced motion, page visibility, mobile overflow and disposal. Also run the shared
`tests/browser.mjs` when changing integration-facing UI behavior. Fixtures are
not a claim of validation against a live SillyTavern theme/profile.
