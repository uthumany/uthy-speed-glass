# UI specification

## Visual direction

A compact native GNOME Shell card inspired by clear liquid glass: dark translucent blue surface, fine cool border, restrained highlight, soft shadow, cyan download identity, violet upload identity, high-contrast text, and short motion. GNOME Shell styling does not provide a browser-style backdrop blur here; depth is built with CSS borders, surface color, and shadows. The theme is original and uses no copied Apple assets.

Tokens:

| Purpose | Default |
|---|---|
| Glass background | `rgba(18, 28, 46, 0.78)` |
| Border/highlight | `rgba(220, 235, 255, 0.28)` / `rgba(255,255,255,0.16)` |
| Download | `#27C9FF` |
| Upload | `#A56BFF` |
| Primary text | `#F5F8FF` |
| Secondary text | `#B7C5DA` |
| Warning/error | `#FFB454` / `#FF647C` |

## Mini

```text
┌────────────────────────────────────────┐
│ UTHY / SPEED GLASS    pin  −  expand  × │
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
│ UTHY / SPEED GLASS       pin  minimize  ▾  ×              │
│ DOWNLOAD                               UPLOAD              │
│ ↓  -- MB/s                              ↑  -- MB/s         │
│ ━━━━━━━━━━━━━━━                         ━━━━━━━━━━━━━━━    │
│ ───── cyan history / violet history ────────────────────   │
│ SESSION RX  —  SESSION TX  —  AVG ↓ —  AVG ↑ —            │
│ Connected · interface · Ping (only when available)         │
│ Pause   Interface   Reset statistics   Preferences          │
└──────────────────────────────────────────────────────────┘
```

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

Buttons have accessible names, are keyboard focusable, and receive visible focus styling. The meters label direction and value in text, not color alone. Reduced-motion preference removes interpolation transitions. Text is high contrast over light/dark wallpapers. Geometry is expressed in logical pixels, bounded by the selected monitor, and re-clamped when monitors change. Mini and compact widths are kept usable on narrow displays; expanded layout is constrained to monitor bounds.

## Limitations before visual acceptance

No screenshot is included because the build environment has no GNOME Shell UI. Actual clipping, fractional scaling, keyboard traversal order, CSS/parser compatibility, high-contrast themes, and multiple-monitor behavior remain **NOT TESTED** until checked on Zorin OS 18.1 Core. The suggested design sizes in the original concept are starting targets; Shell toolbar/control affordances may require slightly more height to remain usable.
