# Mobile follow-up — v0.0.9, 2026-10-21

User-reported behavior: Samsung Internet in installed/app mode shows bloom but
no twinkles/sweeps; Android Chrome in a normal tab shows the effects. Earlier
touch CSS simplification did not resolve the Samsung case. No Samsung device or
live SillyTavern session is available to this worker. Screenshots are evidence of
appearance only; no chat text or character identifiers are copied here.

The user also reports an upward Sheld nudge and horizontal page panning while
scrolling. Both persist with LunarUI recoloring/effects disabled, and persist
with ImmersiveGroups Sheld height set to Automatic. Thus active LunarUI effects
and IG custom height alone do not explain them. Root/visual-viewport panning is
a plausible lead, not an established cause. A padded, scrolled disposable chat
fixture retains its native scroll height across repeated bottom scrolling.

Read-only source findings for the native/IG owner:

- IG `modules/quick-replies.js` computes custom height from visualViewport.height
  and updates on window/visualViewport resize. Its custom height path is inactive
  at zero; do not attribute this report to that path alone.
- IG `styles/scene.css` anchors custom-height Sheld to bottom zero when Moving UI
  is off. Native mobile/VN rules use dynamic viewport units. Check actual root
  scroll offsets, visualViewport offsets/scale and native/computed Sheld bounds
  before changing their sizing or applying offsets.
- Distinguish document scrolling, chat scrolling, visual viewport panning,
  pinch/focus zoom and browser chrome/keyboard resize. Reproduce with LunarUI fully
  disabled, then IG disabled, including a normal browser tab versus app mode.
  Check horizontal overflow from custom theme/extension widths and offsets.

This patch adds a keyframe-independent star/sweep renderer (automatic on touch,
manually selectable), with bounded frame paints and visibility/reduced-motion
cleanup. It also adds an off-by-default experimental root/chat overscroll guard.
The guard leaves dimensions/corners native; it is a reversible workaround to
test, not a confirmed repair of the reported nudge. No IG source or recorder
contract was changed. No recording was analyzed for this investigation.

Validation uses disposable Chromium desktop/touch fixtures, including pixel
brightness with CSS animations blocked, hidden/offscreen/reduced-motion behavior,
scroll bounds, renderer switches and cleanup. These checks cannot establish that
Samsung Internet app mode is fixed.
