# UI specification

## Visual direction

A compact native GNOME Shell card in clear liquid glass with skeuomorphic depth: a dark translucent blue slab lit from the upper left, a fine cool rim, a sheen along the top edge, soft cast shadows, raised glass tiles, engraved grooves, and short spring motion. Cyan keeps the download identity and violet the upload identity. The theme is original and uses no copied assets.

The material model is adapted from the QuickLiquid liquid-glass description ([quickliquid.vercel.app](https://quickliquid.vercel.app/)): one physical definition of tint, sheen, rim light, refraction edge and spring motion, applied consistently to every surface. GNOME Shell's St toolkit has no DOM, WebGL or backdrop blur, so the model is expressed with what St actually renders — vertical gradients for tint and sheen, a light border for the refraction edge, inset shadows for embossing, and a cool rim highlight for the top specular.

Tokens:

| Purpose | Default |
|---|---|
| Glass tint (base) | `rgb(18, 28, 46)` at the user's opacity |
| Glass gradient | `rgb(51, 61, 76)` → `rgb(10, 16, 26)` derived from the tint |
| Rim / refraction edge | `rgba(206, 228, 255, 0.34)` |
| Sheen (title strip) | `rgba(255, 255, 255, 0.14)` → transparent |
| Cast shadow | `rgba(3, 8, 18, 0.58)` at `0 18px 42px` |
| Download | `#27C9FF` |
| Upload | `#A56BFF` |
| Primary text | `#F5F8FF` |
| Secondary text | `#B7C5DA` |
| Focus ring | `rgba(126, 226, 255, 0.95)` + `rgba(39, 201, 255, 0.55)` halo |
| Warning/error | `#FFB454` / `#FF647C` |

## Material system

Depth is layered across the card, its title strip and every sub-surface, because St honours exactly one `box-shadow` per declaration and warns about the rest:

| Surface | Its single shadow spends on | Depth cue |
|---|---|---|
| Card | Cast shadow | Lifts the slab off the desktop |
| Title strip | Inset top highlight | The top edge catching the key light |
| Gauge tile | Outer shadow | Raised glass tile over the card |
| Meter groove | Inset shadow | Engraved channel |
| Meter fill | Accent bloom | Liquid glow |
| Graph window | Inset shadow | Engraved viewport |
| Control bead | Outer shadow, inverted to inset when pressed | Beads press into the surface |
| Statistics and controls rows | Inset top line | Hairline dividers |

Inline styles win over the stylesheet in St, so the card's tint, radius, font size and keyboard focus ring are produced in `src/ui/glassMaterial.js`, and the title strip's sheen is applied there as well.

Layout metrics — paddings, spacings, minimum sizes and font sizes — are unchanged from the previous stylesheet. Paddings are reduced by one pixel wherever a 1px rim border was added, so every control keeps its original footprint.

## Iconography

`icons/` holds the supplied skeuomorphic control set — brand, notification, pin, pinned pin, minimize, expand, close, pause, play, refresh, settings, share, download and upload — prepared by `scripts/prepare-icons.py` from the sources in `assets/icons-source/`. Every icon is a physical object with its own bevel, highlight and contact shadow, so nothing else draws depth for it: the control buttons have a transparent background, no border and no shadow, because a frame around a physical object only doubles every edge.

Two of the sources (`Close.svg`, `minus.svg`) still carried the flat near-white plate and the hairline border of the bitmap they were traced from. The preparation script floods that plate away from the canvas border, drops any remaining component that spans the canvas while hugging its edge, trims each icon to its artwork, and scales every icon so the artwork fills the same share of its box. The shipped files are 96 px PNGs loaded through `Gio.FileIcon`, which renders them in St without theme dependencies; if an asset is missing the factory falls back to the matching symbolic icon from the user's theme.

Two St behaviours shape the set. `St.Icon` defaults to symbolic style, which would flatten the artwork into a monochrome mask, so the bundled icons request `-st-icon-style: regular` while the theme fallback stays symbolic and is tinted by CSS colour. And St paints an outer `box-shadow` as a filled block when the actor has no background while ignoring an inset one, so the focus ring on a bare control is a 2 px border, reserved transparent in the resting state and coloured only on focus, which also keeps the control from resizing when it is focused.

The download and upload marks are the bundled metric icons: 16 px in the mini rows and 18 px in the gauge headings. The statistics captions keep the typographic arrows (↓ ↑), which are embossed with `text-shadow`, and the widgets fall back to those arrows wherever the icon factory is not supplied.

## Title strip

The name plate is the drag handle itself: a dark floor (`rgba(2, 5, 12, 0.72)`), one inset shadow (`inset 0 5px 10px`) for the press, a dark upper lip and a lit lower lip. The lettering is engraved — `rgba(180, 201, 226, 0.96)` with a light `text-shadow` under each glyph — so it reads as cut into the surface; the captured session measures 10.4:1 between the glyphs and the floor. The tool name is **UthyPing**; the extension UUID stays `uthy-speed-glass@uthy` so existing installations and saved settings keep working.

## Mini

```text
┌────────────────────────────────────────┐
│ ◈ UthyPing            pin  ▾  ×        │
│ ↓  -- MB/s             ↑  -- MB/s       │
│   DOWNLOAD               UPLOAD          │
│ ▂▄▆█▇▅▃             ▂▃▅█▆▄▂             │
│ Initializing · interface                 │
└────────────────────────────────────────┘
```

Both rates remain visible simultaneously. Graphs are optional and the connection line only reports observed status/interface values. The title strip is the move handle. Compact mode keeps the same information with more room for history.

## Expanded

```text
┌──────────────────────────────────────────────────────────┐
│ ◈ UthyPing               pin  minimize  ▾  ×              │
│ DOWNLOAD                               UPLOAD              │
│ ↓  -- MB/s                              ↑  -- MB/s         │
│ ━━━━━━━━━━━━━━━                         ━━━━━━━━━━━━━━━    │
│ ───── cyan history / violet history ────────────────────   │
│ SESSION RX  —  SESSION TX  —  AVG ↓ —  AVG ↑ —            │
│ Connected · interface · Ping (only when available)         │
│ Pause   Interface   Reset statistics   Preferences          │
└──────────────────────────────────────────────────────────┘
```

## Motion

Motion lives in `src/ui/motion.js` and only ever animates transform, opacity or the width of a meter fill, so nothing triggers a layout pass and no JS timers are used:

| Gesture | Behaviour | Duration |
|---|---|---|
| Press | Squash to 0.94 | 110 ms, ease-out cubic |
| Release | Overshoot back to rest | 240 ms, ease-out back |
| Hover | Lift to 1.06 | 150 ms, ease-out cubic |
| Meter update | Spring to the new fill width | 220 ms |
| Fresh reading | Single 1.03 pulse | 180 ms, ease-out back |
| Brand mark | Looping opacity and scale breathing | 2600 ms, auto-reversed |

Breathing is implemented with looping `Clutter.PropertyTransition`s and stops when the card is hidden. With the Reduce motion preference enabled, every duration collapses, idle loops stop, and values change instantly.

## Interaction model

- **Expand:** reveals gauges, graph, statistics, interface cycling, pause/resume, reset, and preferences.
- **Minimize:** returns to the mini card while retaining both readings; it does not stop sampling.
- **Close:** hides the card but leaves the panel indicator and monitoring service available; the panel menu can show it again.
- **Pin:** locks title-strip movement; it does not stop monitoring or disable resize.
- **Move:** drag the title strip; position is clamped to a monitor and persisted on release.
- **Resize:** drag the bottom-right affordance; logical width/height are clamped and persisted.
- **Pause/resume:** removes/restarts the sampling timer; resume establishes a fresh baseline.
- **Interface:** expanded button cycles through automatic and currently observed interfaces; preferences provide direct selection.
- **Reset:** clears session totals, peaks, averages, and visible history without resetting kernel counters.
- **Ping:** preference enables a local default-gateway measurement; ping remains absent from the status line unless a result exists.

## Accessibility and responsive behavior

Buttons have accessible names, are keyboard focusable, and receive a visible cyan focus ring drawn outside the border box, so focusing never shifts layout. Text is embossed with a subtle shadow to stay high contrast over both the light and dark parts of the glass, and contrast ratios of the primary and secondary text against the darkest and lightest glass tones were checked. The meters label direction and value in text, not colour alone. Reduced-motion removes interpolation transitions. Geometry is expressed in logical pixels, bounded by the selected monitor, and re-clamped when monitors change.

## Verification status

Captured from a nested GNOME Shell 46 session with the extension enabled: mini, compact and expanded layouts, a hovered control, and the icon set at its true 16 px render size. The nested run reported no `St-WARNING`, no JavaScript error and no CSS parse warning, which also confirms the one-shadow-per-declaration discipline.

Still **NOT TESTED**: Zorin OS 18.1 on real hardware, fractional scaling, high-contrast and light Shell themes, keyboard traversal order on a physical session, and multi-monitor behaviour.
