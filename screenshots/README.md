# Screenshots

Captured from a nested GNOME Shell 46 session (`gnome-shell --nested --wayland`) with the extension enabled and live traffic running, installed through `scripts/install.sh` into a temporary `XDG_DATA_HOME`.

| File | Content |
|---|---|
| `uthy-glass-expanded.png` | Expanded layout: recessed metric wells, the live chart, the statistics row, the LED and the floating control tray |
| `uthy-glass-hover.png` | The same layout with a tray control under the pointer |
| `uthy-glass-mini.png` | Mini layout on the desktop |
| `uthy-glass-compact.png` | Compact layout with the taller chart |
| `zoom-expanded.png` | Enlarged crop of the expanded card for reviewing the material |
| `zoom-mini.png` | Enlarged crop of the mini card |
| `zoom-title-strip.png` | The `UthyPing` name plate: square recess, inset press, dark upper lip, lit lower lip and engraved lettering |
| `zoom-tray-expanded.png`, `zoom-tray-hover.png`, `zoom-tray-pressed.png` | A tray control at rest, lifted two pixels on hover, and pressed into its own inset shadow |
| `zoom-led.png` | The connection LED: bloom, lit dome, inner shadow, specular highlight and contact ring |
| `preferences.png` | The GTK4 preferences window: the same square, silver-and-orange material, and no corner-radius row any more |
| `panel-indicator.png` | The bundled mark in the panel indicator |
| `icon-set-3d.png` | The prepared icon set at 96 px, the size the sources are rendered at before they are trimmed |
| `icon-set-16px.png` | The same set at its true 16 px render size, which is the size that matters for legibility |
| `speed-slow-link.png` | A link throttled to 25 KB/s: the readout shows `B/s` and `KB/s` values and the chart keeps its trace, where a MB/s-only readout showed `0.0 MB/s` and a flat line |
| `a11y-focus-card.png` | Orange focus ring around the card after pressing it |
| `a11y-focus-control.png`, `a11y-focus-control-2.png` | The ring moving between controls on Tab: a title-strip icon, then a tray plate |
| `a11y-focus-released.png` | No ring left after Escape |

The nested session reported no `St-WARNING`, no JavaScript error and no CSS parse warning. Contrast ratios, the focus-ring measurements, the reduced-motion result and the icon preparation rules measured in these sessions are recorded in [docs/ACCESSIBILITY.md](../docs/ACCESSIBILITY.md), [docs/UI_SPECIFICATION.md](../docs/UI_SPECIFICATION.md) and [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md). These captures are a verification aid, not a substitute for checking a physical Zorin OS 18.1 session: fractional scaling, high-contrast and light Shell themes, and multi-monitor behaviour remain untested.
