# UI specification

## Visual direction

A square liquid-glass slab with skeuomorphic depth: a dark translucent surface lit from the upper left, a fine silver rim, a sheen along the top edge, a faint grid and grain inside the glass, recessed metric wells, engraved secondary labels, raised control plates and a floating tray that hovers below the slab. One glowing orange accent carries anything focused, active or measured; everything else is near-black, off-white and silver. Corners are square throughout — the radius is part of the material, not a setting — and the only round object in the interface is the connection LED, because a dot has to be a dot.

The material model is adapted from the QuickLiquid liquid-glass description ([quickliquid.vercel.app](https://quickliquid.vercel.app/)): one physical definition of tint, sheen, rim light, refraction edge and spring motion, applied consistently to every surface. GNOME Shell's St toolkit has no DOM, no WebGL and, in the 45–50 series, **no backdrop sampling**: there is no `backdrop-filter`, no `filter`, and no way for an actor to read or blur what is painted behind it. Thickness is therefore implied rather than performed — a dark tint, a vertical sheen, a grain layer, a 1 px bright rim and a wide cast shadow together read as a slab of glass, and the documentation says so rather than claiming a blur that never happens.

Tokens:

| Purpose | Default |
|---|---|
| Glass tint (base) | `rgb(14, 18, 26)` at the user's opacity |
| Glass gradient | `rgb(63, 67, 73)` → `rgb(8, 10, 15)` derived from the tint |
| Rim / refraction edge | `rgba(255, 255, 255, 0.12)` |
| Specular rim (backdrop) | `rgba(255, 255, 255, 0.20)` top, `rgba(0, 0, 0, 0.45)` bottom |
| Grid / grain | `rgba(255, 255, 255, 0.030)` at a 22 px pitch |
| Cast shadow | `rgba(0, 0, 0, 0.40)` at `0 20px 40px` |
| Accent (focus, active, metrics) | `#FF8A1F`, lit `#FFC078`, deep `#A94A05` |
| Download | `#FF8A1F` |
| Upload | `#93A6B8` |
| Primary text | `#F2F5F8` |
| Secondary text (engraved) | `#9DABB9` |
| LED — connected | `#2FE08A` |
| LED — initialising / paused | `#FFC24D` |
| LED — disconnected / error | `#FF6B5A` |
| LED — stopped | `#8A93A0` |

## Depth order

The z-axis is explicit: the desktop, then the slab, then the wells pressed into it, then the tray hovering above it.

| Layer | Actor | What it carries |
|---|---|---|
| 1. Desktop | — | Casts the slab's shadow |
| 2. Slab | card (`Clutter.BinLayout`) | Tint, border, cast shadow, focus ring |
| 3. Inner surface | `glassBackdrop.js` | Sheen, grid, grain, specular rim |
| 4. Content | `uthy-card-stack` column | Title strip, readings, wells, chart |
| 5. Grip and tray | anchored bottom layers | Resize grip, floating control tray |

St honours exactly one `box-shadow` per declaration and warns about the rest, so each surface spends its single shadow on the cue that matters most for it. Where a recess needs two inset cues — dark at the top left, lit at the bottom right — the second one is a border, not a shadow:

| Surface | Its single shadow spends on | Second cue |
|---|---|---|
| Card | Cast shadow | 1 px silver rim, focus ring in orange |
| Backdrop | — (Cairo) | Sheen, grid, grain, top and bottom rim lines |
| Metric well | Inset dark press | Lit lower and right border |
| Meter groove | Inset dark press | Lit lower border |
| Meter fill | Accent bloom | Lit top border, dark bottom border |
| Chart window | Inset dark press | Lit lower border, grid inside |
| Control plate (rest) | Contact shadow | Lit top border, dark bottom border |
| Control plate (pressed) | Inset dark press | Inverted borders |
| Floating tray | Wide cast shadow | Lit top border, dark bottom border |

Inline styles win over the stylesheet in St, so the card's tint, cast shadow and focus ring, the metric wells, the meter groove and fill, and the tray's slab are produced in `src/ui/glassMaterial.js`. The grid, the grain and the rim lights cannot be expressed in CSS at all — St has no repeating backgrounds — so they are painted by `src/ui/glassBackdrop.js` on a single `St.DrawingArea` that covers the card and repaints only when its size changes.

## Typography

Every numeric readout carries `font-feature-settings: "tnum"`, so a changing digit never reflows the label beside it: the mini rates, the gauge values and the statistic values all use tabular figures. Secondary labels — `DOWNLOAD`, `UPLOAD`, `SESSION RX`, `Peak` — are engraved: a dim `#9DABB9` with a single light `text-shadow` below the glyph, so they read as cut into the glass rather than printed on it.

## Iconography

`icons/` holds the supplied skeuomorphic control set — brand, notification, pin, pinned pin, minimize, expand, close, pause, play, refresh, settings, share, download and upload — prepared by `scripts/prepare-icons.py` from the sources in `assets/icons-source/`. Every icon is a physical object with its own bevel, highlight and contact shadow.

Two of the sources (`Close.svg`, `minus.svg`) still carried the flat near-white plate and the hairline border of the bitmap they were traced from. The preparation script floods that plate away from the canvas border, drops any remaining component that spans the canvas while hugging its edge, trims each icon to its artwork, and scales every icon so the artwork fills the same share of its box. The shipped files are 96 px PNGs loaded through `Gio.FileIcon`, which renders them in St without theme dependencies; if an asset is missing the factory falls back to the matching symbolic icon from the user's theme.

The title-strip buttons draw **no** frame: the icons are objects in their own right, so a plate around them would double every edge. The four tray controls are the opposite case — the design asks for physical buttons, so each one is a raised square plate with a silver rim and a contact shadow, and the icon sits on top of it. Two St behaviours shape the set. `St.Icon` defaults to symbolic style, which would flatten the artwork into a monochrome mask, so the bundled icons request `-st-icon-style: regular` while the theme fallback stays symbolic and is tinted by CSS colour. And St paints an outer `box-shadow` as a filled block when the actor has no background while ignoring an inset one, so the focus ring on a bare control is a 2 px border, reserved transparent in the resting state and coloured only on focus, which also keeps the control from resizing when it is focused.

The download and upload marks are the bundled metric icons: 16 px in the mini rows and 18 px in the gauge headings. The statistics captions keep the typographic arrows (↓ ↑), which are embossed with `text-shadow`, and the widgets fall back to those arrows wherever the icon factory is not supplied.

## Title strip

The name plate is the drag handle itself: a dark floor (`rgba(3, 5, 9, 0.74)`), one inset shadow (`inset 0 5px 10px`) for the press, a dark upper lip and a lit lower lip, all square. The lettering is engraved — `rgba(198, 212, 228, 0.96)` with a light `text-shadow` under each glyph — so it reads as cut into the surface; the captured session measures 11.5:1 between the glyphs and the floor. The tool name is **UthyPing**; the extension UUID stays `uthy-speed-glass@uthy` so existing installations and saved settings keep working.

## Mini

```text
┌────────────────────────────────────────┐
│ ◈ UthyPing            pin  ▾  ×        │
│ ◉ 174 KB/s             ◉ 7.1 KB/s      │
│   DOWNLOAD               UPLOAD         │
│ ▁▂▄▆█▇▅▃ live chart, orange over silver │
│ ● eth0                                  │
└────────────────────────────────────────┘
```

Both rates remain visible simultaneously. Graphs are optional. The connection line is one glowing LED beside the interface name: the state is carried by the LED colour (and by the accessible name), not by a sentence, so the line stays short at every width. The title strip is the move handle. Compact mode keeps the same information with more room for history.

## Expanded

```text
┌──────────────────────────────────────────────────────────┐
│ ◈ UthyPing               pin  minimize  ▾  ×              │
│ ┌─ recessed well ────────┐ ┌─ recessed well ───────────┐ │
│ │ ◉ DOWNLOAD             │ │ ◉ UPLOAD                  │ │
│ │ 122 KB/s               │ │ 5.0 KB/s                  │ │
│ │ ▓▓▓▓▓▓▓▓░░░ groove     │ │ ▓░░░░░░░░░░ groove        │ │
│ │ Peak 123 KB/s          │ │ Peak 5.0 KB/s             │ │
│ └────────────────────────┘ └───────────────────────────┘ │
│ ┌─ engraved chart window ─────────────────────────────┐  │
│ │ grid + orange area + silver area + peak + live head │  │
│ └─────────────────────────────────────────────────────┘  │
│ SESSION RX  —   SESSION TX  —   AVG ↓ —   AVG ↑ —        │
│ ● eth0                                                   │
│        ╔═════════════════════════════════════╗           │
│        ║ ⏸   Auto   ⟳   ⚙                   ║ ← floats   │
└────────╚═════════════════════════════════════╝───────────┘
```

The four controls left the column: they sit on a separate slab that hovers ten pixels below the panel's bottom edge, with a wide cast shadow, so the stack reads as desktop → panel → controls. The column reserves their strip so nothing is hidden behind them.

## Live chart

The chart is a dual-layer area sparkline drawn in Cairo (`src/ui/historyGraph.js`), not a flat line:

- a faint light-grey grid and an engraved baseline give the plot a surface;
- each wave is filled with a vertical gradient that fades downward, so download and upload overlap without muddying;
- each wave is stroked twice — a 4 px translucent glow under a 1.6 px lit line;
- the tallest download sample is marked with a halo, a leader line and a bright dot;
- the newest sample carries a glowing live head on the right edge.

With no samples yet the grid alone is drawn, which reads as an empty instrument rather than a broken line. A 0.01 MB/s floor keeps a slow link's trace visible where a 0.1 MB/s floor flattened it.

## Connection LED

The connection state is a single 3D dot (`src/ui/ledIndicator.js`): an outer bloom, a dome lit from the upper left, an inner shadow along its lower edge, a specular highlight and a dark contact ring. The colour carries the state; the accessible name repeats it in words. The dome is redrawn only when the state changes, and it pulses once on a change unless reduced motion is on.

## Motion

Motion lives in `src/ui/motion.js` and only ever animates transform, opacity or the width of a meter fill, so nothing triggers a layout pass and no JS timers are used:

| Gesture | Behaviour | Duration |
|---|---|---|
| Bare icon: press | Squash to 0.94 | 110 ms, ease-out cubic |
| Bare icon: release | Overshoot back to rest | 240 ms, ease-out back |
| Bare icon: hover | Lift to 1.06 | 150 ms, ease-out cubic |
| Raised control: hover | Travel to −2 px and grow to 1.02 | 150 ms, ease-out cubic |
| Raised control: press | Travel to +1 px and squash to 0.97 | 110 ms, ease-out cubic |
| Raised control: release | Settle to 0 px with overshoot | 240 ms, ease-out back |
| Meter update | Spring to the new fill width | 220 ms |
| Fresh reading | Single 1.03 pulse | 180 ms, ease-out back |
| LED state change | Single 1.18 pulse | 200 ms |
| Brand mark | Looping opacity and scale breathing | 2600 ms, auto-reversed |

Breathing is implemented with looping `Clutter.PropertyTransition`s and stops when the card is hidden. With the Reduce motion preference enabled, every duration collapses, idle loops stop, and values change instantly — verified by measuring the icon's position while hovering, which moves 1.71 px with motion on and 0.00 px with it off.

## Interaction model

- **Expand:** reveals gauges, chart, statistics, interface cycling, pause/resume, reset, and preferences.
- **Minimize:** returns to the mini card while retaining both readings; it does not stop sampling.
- **Close:** hides the card but leaves the panel indicator and monitoring service available; the panel menu can show it again.
- **Pin:** locks title-strip movement; it does not stop monitoring or disable resize.
- **Move:** drag the title strip; position is clamped to a monitor — with a bottom inset for the tray's overhang — and persisted on release.
- **Resize:** drag the bottom-right grip; logical width/height are clamped and persisted.
- **Pause/resume:** removes/restarts the sampling timer; resume establishes a fresh baseline.
- **Interface:** the tray's labelled button cycles through automatic and currently observed interfaces; preferences provide direct selection.
- **Reset:** clears session totals, peaks, averages, and visible history without resetting kernel counters.
- **Ping:** preference enables a local default-gateway measurement; ping appears in the status line only when a result exists.

## Accessibility and responsive behavior

Buttons have accessible names, are keyboard focusable, and receive a visible **orange** focus ring. The card's ring is drawn outside the border box by the material, so focusing never shifts layout; the bare controls use a reserved transparent border that is coloured on focus; the raised plates turn their rim orange. The LED, the rates and the status row all carry accessible names, and the meters label direction and value in text rather than by colour alone. Measured in the captured session: metric value 13.2:1, `Peak` label 6.7:1, status text 9.9:1, statistic value 16.2:1, the orange meter against its groove 10.4:1, the engraved name plate 11.5:1 — all above the 4.5:1 small-text and 3:1 non-text thresholds. Reduced motion removes every interpolation. Geometry is expressed in logical pixels, bounded by the selected monitor, and re-clamped when monitors change.

## Verification status

Captured from a nested GNOME Shell 46 session with the extension enabled: mini, compact and expanded layouts, the floating tray at rest, hovered and pressed, the connection LED, the title strip, and the focus ring on the card, on a title-strip control and on a tray control. The nested run reported no `St-WARNING`, no JavaScript error and no CSS parse warning, which also confirms the one-shadow-per-declaration discipline.

Still **NOT TESTED**: Zorin OS 18.1 on real hardware, fractional scaling, high-contrast and light Shell themes, keyboard traversal order on a physical session, and multi-monitor behaviour.
