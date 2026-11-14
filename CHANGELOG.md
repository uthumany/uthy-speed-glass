# Changelog

## Unreleased

- Rebuilt the whole type scale as engraved typography. Every label is now a pair of stacked copies: a dark copy offset up by the role's depth, which reads as the inner shadow the near wall of the impression casts over the glyph, and an ink copy in a metal tone carrying one sharp lit line along its lower edge, which reads as the far wall catching light. St allows one `text-shadow` per declaration, so the pair is the only way to get both cues.
- Punched the captions into brushed metal. `src/ui/metalPlate.js` paints a metal gradient, deterministic grain, a diagonal specular sweep, the dark inner shadow of the impression, the lit far wall, the outer lip and a clear glass sheen, so DOWNLOAD, UPLOAD, SESSION RX and the averages read as recessed into the surface instead of printed on it.
- Turned the name plate into the same painted material: brushed metal, a deeper impression and a glass sheen, with UthyPing letterpressed into it, in place of the flat CSS recess.
- Stamped the readings, the peak, the interface name and the Auto label with the same two-cue press, so no text in the widget is flat any more. The 22 px reading is pressed two pixels deep and the small labels one.
- Recorded the three St facts the typography turned up, because each one cost a rendering pass to find: a label allocated a fraction under its natural width ellipsizes rather than clipping, so the padding has to live on a row inside the band rather than on the measured label; a child of a vertical box is stretched to the full width unless it sets `x_align`; and `clutter_text.ellipsize` should be pinned explicitly.
- Rebuilt the surface as a square liquid-glass slab over a skeuomorphic body. Corners are square everywhere — the corner-radius setting is gone — and the palette is one glowing orange accent (`#FF8A1F`) for anything focused, active or measured, over near-blacks, off-whites and silver rims.
- Added `src/ui/glassBackdrop.js`: a single DrawingArea paints the layers St cannot express in CSS — a top sheen, a 22 px light-grey grid, a deterministic grain at 0.03 opacity, and the bright top / dark bottom rim lights. It repaints only when the card is resized.
- Added `src/ui/ledIndicator.js`: the connection state is now a 3D emerald LED beside the interface name instead of a sentence, with an outer bloom, a lit dome, an inner shadow, a specular highlight and a dark contact ring. The colour carries the state; the accessible name repeats it in words.
- Rebuilt the history chart as a live dual-layer area sparkline: a faint grid, gradient fills that fade downward, a glow under each lit line, a haloed peak marker with a leader line, and a glowing live head on the newest sample. With no samples yet the grid alone is drawn.
- Made the metric cards recessed glass wells — an inset dark press plus a lit lower and right border, because St only honours one shadow per declaration — and turned the meter tracks into square grooves with a bevelled, glowing fill that casts a small shadow onto the groove.
- Turned the four expanded controls into a floating tray that hovers ten pixels below the panel's bottom edge with a wide cast shadow, so the stack reads as desktop, panel, controls. Move clamping keeps a bottom inset so the tray stays on screen.
- Made the tray controls physical buttons: raised at rest, travelling two pixels towards the pointer on hover, and pressing one pixel into their own inset shadow when active. The title-strip icons stay frameless.
- Added `font-feature-settings: "tnum"` to every numeric readout so a changing digit never reflows the label beside it, and engraved the secondary labels with a light edge below the glyph.
- Applied the same material to the preferences window: square corners, an orange accent, and sliders whose trough is a groove and whose thumb is a lit, bevelled handle.
- Moved the download accent to `#FF8A1F` and the upload accent to `#93A6B8` so both metrics sit inside the new palette; existing installations keep the colours they already saved.
- Replaced the whole icon set with the supplied skeuomorphic 3D artwork. `scripts/prepare-icons.py` renders each source, floods away the flat plate and hairline frame that two of them still carried, trims each icon to its artwork and writes a 96 px PNG, so no icon is drawn inside a frame any more.
- Renamed the tool to **UthyPing** and gave the name a deeply pressed-in neumorphic plate: a dark recess with an inset shadow, a dark upper lip and a lit lower lip, and engraved lettering that measures 10.4:1 against the floor. The extension UUID is unchanged, so existing installs and settings keep working.
- Removed the plate, border and shadow from the icon buttons. The supplied icons are physical objects with their own bevel and contact shadow, so a frame around them only doubled every edge; hover is now a soft wash and the press squash comes from the motion helper.
- Rebuilt the control focus ring as a border that is reserved transparent in the resting state: St paints an outer `box-shadow` as a filled block behind an actor with no background and ignores an inset one, so the previous ring either filled the control or vanished.
- Added the download and upload icons to the mini readings and the gauge headings, in place of the typographic arrows, which remain as the fallback when an asset is missing.
- Added the bundled logo to the preferences page icon and the bundled mark to the panel indicator.
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
