# Screenshots

Captured from a nested GNOME Shell 46 session (`gnome-shell --nested --wayland`) with the extension enabled and live traffic running, installed through `scripts/install.sh` into a temporary `XDG_DATA_HOME`.

| File | Content |
|---|---|
| `uthy-glass-mini.png` | Mini layout on the desktop |
| `uthy-glass-compact.png` | Compact layout with the history graph |
| `uthy-glass-expanded.png` | Expanded layout with gauges, graph, statistics and controls |
| `uthy-glass-hover.png` | Expanded layout with a control under the pointer |
| `zoom-mini.png`, `zoom-expanded.png` | Enlarged crops for reviewing the material |
| `zoom-title-strip.png` | The `UthyPing` name plate: recessed floor, inset press, dark upper lip, lit lower lip and engraved lettering |
| `zoom-controls-expanded.png`, `zoom-controls-hover.png` | Resting and hovered control row; the icons carry their own depth and their buttons draw no frame, so hover is a soft wash |
| `panel-indicator.png` | The bundled mark in the panel indicator |
| `icon-set-3d.png` | The prepared icon set at 24, 48 and 96 px, and a magnified view of each icon |
| `icon-set-16px.png` | The same set at its true 16 px render size, which is the size that matters for legibility |
| `speed-slow-link.png` | A link throttled to 25 KB/s: the readout shows `B/s` and `KB/s` values and the graph keeps its trace, where a MB/s-only readout showed `0.0 MB/s` and a flat line |
| `a11y-focus-card.png` | Focus ring around the card after pressing it |
| `a11y-focus-control.png`, `a11y-focus-control-2.png` | The ring moving between controls on Tab |
| `a11y-focus-released.png` | No ring left after Escape |

The nested session reported no `St-WARNING`, no JavaScript error and no CSS parse warning. Contrast ratios, the focus-ring measurements and the reduced-motion results measured in these sessions are recorded in [docs/ACCESSIBILITY.md](../docs/ACCESSIBILITY.md), and the icon preparation rules in [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md). These captures are a verification aid, not a substitute for checking a physical Zorin OS 18.1 session: fractional scaling, high-contrast and light Shell themes, and multi-monitor behaviour remain untested.
