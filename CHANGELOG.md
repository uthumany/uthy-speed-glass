# Changelog

## Unreleased

- Fixed the rate readout collapsing real traffic to `0.0 MB/s`: the unit now follows the value (`B/s`, `KB/s`, `MB/s`, `GB/s`), so the tens of KB/s that ordinary browsing produces stay visible instead of rounding away.
- Fixed the speed meter being pinned to a 10 MB/s span, which left the bar near the start of its travel on any slower link and made a working monitor look idle; it now scales to the busiest of the last 30 samples.
- Lowered the history graph floor from 0.1 MB/s to 0.01 MB/s so light traffic no longer draws a flat line.
- Made the focus ring reachable: the widget takes key focus when pressed, cycles its buttons on Tab, Shift+Tab and the arrow keys, and releases focus on Escape. St never focuses a chrome actor, so the ring was previously unreachable.
- Kept the title strip legible on bright wallpapers by giving it a dark base under the sheen; the brand label measured 4.16:1 at the minimum transparency before the fix and 7.99:1 after.
- Reworked the widget surface as liquid glass with skeuomorphic depth: top-lit gradient tint, refraction rim, cast shadow, raised gauge tiles, engraved meter grooves and graph window, embossed text and hairline dividers.
- Added a generated 3D control icon set with one shared light model, loaded through `Gio.FileIcon` with a symbolic-theme fallback, and fixed the installable ZIP so the bundled `icons/` assets ship with it.
- Added spring motion for press, release, hover and fresh readings plus idle breathing for the brand mark, all transform-only and disabled by the Reduce motion preference.
- Fixed the meter and icon-button styling to use one `box-shadow` per declaration, removing the St warnings caused by multi-layer shadows that St silently discarded.
- Added a visible keyboard focus ring drawn outside the border box, so focus no longer changes layout.

## 1.0.0 — initial release

- Initial modular GNOME Shell extension source for live local RX/TX throughput.
- Added automatic/manual interface selection, disconnect and counter-reset recovery, bounded graphs, and session statistics.
- Added floating mini/compact/expanded presentation, drag/resize/pin, persisted settings, panel menu, and GTK4/Libadwaita preferences.
- Added optional local-gateway ping, reduced-motion support, per-user install/remove scripts, deterministic packaging, tests, documentation, and GitHub Actions workflow.
- Automated checks pass in the build environment. GNOME Shell operation on Zorin OS 18.1, preferences rendering, and interactive desktop behaviors remain untested. GNOME Extensions review has not been sought.
