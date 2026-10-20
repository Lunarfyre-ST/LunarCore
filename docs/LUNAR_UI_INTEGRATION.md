# LunarUI extension opt-out contract (v0.0.9)

Other extensions can protect their own UI with a DOM attribute. No imports,
registration calls, LunarCore installation checks, events or diagnostics hooks
are required. The marker is harmless when LunarCore is absent.

```html
<section id="my-extension-settings" data-lunar-ui="off">
  <!-- Extension-owned settings, buttons, custom colors and layout -->
</section>
```

| Attribute value | Boundary |
| --- | --- |
| `off` | Exclude the element and descendants from LunarUI colors and effects |
| `colors` | Keep native/extension colors; permit decorative effects |
| `effects` | Keep recoloring; exclude decoration and content-layer classes |
| `colors effects` | Same protection as `off` |
| Missing / empty | Normal LunarUI behavior |

These are whitespace-separated, case-sensitive tokens. Unknown tokens do
nothing. Descendants cannot override an ancestor's opt-out. Remove the marker
from the boundary to restore participation.

## JavaScript and late-loaded UI

```js
const panel = document.createElement('section');
panel.dataset.lunarUi = 'off';  // Set before mounting to avoid a themed first frame.
panel.append(myExtensionContent);
settingsContainer.append(panel);

// Change a live boundary; effects update on the next animation frame.
panel.dataset.lunarUi = 'colors';
panel.removeAttribute('data-lunar-ui');
```

New/replaced elements and attribute changes are supported. LunarUI removes its
owned decoration/layout classes from excluded descendants and resumes when the
marker is cleared. Colors follow the CSS cascade immediately. A parent surface's
stars, bloom and sweep are clipped around excluded rectangles, so an outer panel
cannot decorate across the private region. Rectangles that overlap are merged
conservatively. If path clipping is unsupported or more than 128 exclusion roots
occur in one surface, that ancestor decoration is hidden; other surfaces continue.

Put a stable boundary around moving/animated content. Clipping updates on layout
changes, scroll, resize and transition completion. Mark separately mounted
popouts/dialogs too: a marker follows DOM ancestry, not logical component ownership.
For shadow DOM, put the marker on its light-DOM host.

## Color behavior and limits

LunarUI's direct recolor rules exclude the boundary and descendants. The marker
restores SillyTavern's native body, emphasis, quote, border, panel and chat theme
variables using aliases resolved at `:root`, before LunarUI's body recolor. Native
root theme updates propagate without stale snapshots. Extension-owned local
styles retain their normal cascade priority; LunarUI's restoration rule has zero
specificity. If a custom theme defines its palette only on `body` instead of
SillyTavern's document-root variables, define the desired palette explicitly on
your extension root. LunarUI cannot infer arbitrary third-party CSS intent.

Opt-outs do not undo surrounding native layout, an ancestor's backgrounds or
other extensions' CSS. Shared native surfaces can still serve as decoration
anchors outside the excluded subtree. Extensions needing an independent absolute
positioning context should establish it on their own root. LunarUI's internal
classes/custom properties are implementation details, not extension hooks.

The contract applies to LunarUI only. It does not enable/disable LunarDebug or
change its collection rules. No attribute labels, DOM text, input values,
extension state, exclusion coordinates or custom preset names are sent to the
recorder by this feature.

## Suggested integration checks

Check with LunarCore absent, recoloring/effects independently off/on, a late
mount, a changed marker, native theme changes, scrolling and a separately mounted
popup. Your extension should remain independently usable in all cases. LunarUI's
own disposable browser fixture covers the base contract; this is not a claim
of validation against every theme or extension.
