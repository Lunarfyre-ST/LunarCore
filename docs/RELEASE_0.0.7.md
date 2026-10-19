# v0.0.7

Adds Twilight, a darker indigo/purple profile with more transparency, and softens
Moonlight Blue's surrounding tint and glow. Each profile remembers its own panel
opacity. Existing enabled Moonlight preferences are preserved.

Adds independently toggleable starlight twinkles, shining sweeps and a breathing
edge glow, with intensity and speed controls. Effects start off, remain on
settings headers, pause offscreen/in hidden tabs, and respect reduced motion.
Disabling recoloring restores the current underlying native theme; disabling
effects removes the decorative layers and observers.

See [LunarUI](LUNAR_UI.md) for controls, persistence and verification. Export
schema remains 4 and producer protocol remains 1. Recorder schemas are unchanged;
the existing Moonlight-only preset event remains compatible. No companion
ImmersiveGroups update is required for these UI features.
