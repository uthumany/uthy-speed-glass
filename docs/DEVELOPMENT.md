# Development

All `scripts/...` commands below assume the terminal's current directory is the repository root (the folder containing `scripts/` and `metadata.json`). From another directory, first run `cd /path/to/uthy-speed-glass` using the actual checkout path.

## Requirements

For runtime development, use the target GNOME desktop with GNOME Shell 45–50, GJS, GTK4, Libadwaita, GLib schema tools, and a GNOME extension manager. The exact GNOME Shell/GJS versions on the target Zorin OS 18.1 machine were not available in this build environment; inspect them before installing:

```bash
gnome-shell --version
gjs --version
echo "$XDG_SESSION_TYPE"
command -v gnome-extensions glib-compile-schemas
```

Zorin OS 18.1 Core is documented by Zorin as Ubuntu 24.04 LTS with GNOME Shell; Lite is Xfce. See the current [Zorin technical details](https://zorin.com/os/details/) and the [GNOME extension guide](https://gjs.guide/extensions/).

For deterministic unit tests and source syntax checks, Node.js is a **development-only** tool. It is not imported by the installed extension. No npm packages are required.

## Repository layout

The Shell runtime is in `extension.js` and `src/`; the separate preferences process is `prefs.js`. GSettings lives in `schemas/`. Unit tests are in `tests/`, scripts in `scripts/`, and user/developer documentation in `docs/`. `package.json` only declares the local Node test command and is never copied into the runtime ZIP.

## Validate and test

```bash
bash scripts/validate.sh
node --test tests/*.test.js
```

The validation script checks metadata/schema consistency, strict schema compilation, JavaScript syntax, deterministic tests, and shell syntax. It runs ShellCheck when installed and always identifies desktop runtime tests that were not performed; a passing Node check does not prove that GJS imports or Shell APIs work.

On a GNOME development session, additionally inspect the extension with:

```bash
gnome-extensions info uthy-speed-glass@uthy
gnome-extensions prefs uthy-speed-glass@uthy
journalctl -f -o cat /usr/bin/gnome-shell
```

Test a fresh session and disable/re-enable cycles. Wayland and X11 differ in restart behavior. Do not assume a successful static test validates multiple monitors, scaling, or Shell CSS rendering.

## Build the installable ZIP

```bash
bash scripts/package.sh
bash scripts/package-source.sh
```

The installable build stages runtime files, compiles `gschemas.compiled`, checks the archive paths, and writes a SHA-256 file under `dist/`. If a compatible `gnome-extensions pack --out-dir` command exists, the script asks it to validate the staged extension; Python's standard library then creates the canonical sorted ZIP with normalized timestamps. When the GNOME packer is absent or fails, the same deterministic ZIP builder is used. `package-source.sh` creates a separate timestamp-normalized archive of the full project while excluding generated artifacts and caches.

The runtime ZIP carries `icons/`, because the toolbar loads those assets at run time. `package.sh` fails if the staged archive carries fewer than the fourteen bundled icons.

## Prepare the icon set

`assets/icons-source/` keeps the supplied skeuomorphic sources, one SVG per control. `icons/` is build output, not hand-edited art: `scripts/prepare-icons.py` renders each source at 256 px, floods the background away from the canvas border, drops any component that spans the canvas while hugging its edge (the flat plate and hairline frame that two of the sources still carried), trims each icon to its artwork, scales every icon so the artwork fills the same share of its box and writes a 96 px PNG:

```bash
sudo apt install librsvg2-bin        # provides rsvg-convert
python3 scripts/prepare-icons.py
```

The script needs `rsvg-convert` and Pillow, is deterministic, and should be run after replacing or editing a source icon. Review the result at its true render size before committing:

```bash
for size in 16 24 48; do
  rsvg-convert -w "$size" -h "$size" assets/icons-source/Reload.svg -o "/tmp/refresh-$size.png"
done
```

St renders the PNGs through `Gio.FileIcon`. If an asset is missing at run time the icon factory falls back to the matching symbolic icon from the user's theme, so a partial install still shows a usable toolbar.

Eight St behaviours were established by rendering inside a nested Shell and must be respected by any new icon, surface, control or label:

1. **St.Icon defaults to symbolic style**, which flattens an icon into a monochrome mask and discards the artwork. The `uthy-3d-icon` class sets `-st-icon-style: regular` so the supplied assets keep their depth; the symbolic fallback deliberately keeps the default so the theme icon is tinted by the CSS colour.
2. **An outer box-shadow is painted as a filled block behind an actor with no background, and an inset box-shadow is not painted at all.** The title-strip buttons are transparent by design, so their focus ring is a 2 px border that is reserved transparent in the resting state and only coloured on focus. Anything that needs a visible ring on a transparent actor must use a border.
3. **There is no backdrop sampling.** St 14 (GNOME Shell 46) has no `backdrop-filter`, no `filter` and no way for an actor to read what is painted behind it, so a glass slab cannot actually blur the desktop. Thickness is implied by a tint, a sheen, a grain layer and a bright 1 px rim instead; do not write CSS that claims a blur. Cairo is available to a `St.DrawingArea` through `import cairo from 'gi://cairo'`, but GJS exposes gradient stops as `addColorStopRGBA(offset, r, g, b, a)` — plain `addColorStop` does not exist.
4. **`Clutter.BinLayout` fills a child that expands and centres one that does not**, and it has no alignment properties of its own (`x_align`/`y_align` on the layout raise "No property" errors). To pin a child to the bottom edge, fill the layer with an expanding column and let a `y_expand` spacer push the child down.
5. **`font-feature-settings` is supported**, so tabular figures (`"tnum"`) can be requested for numeric readouts; `transform`, `filter` and repeating backgrounds are not, which is why the grid and the grain are painted in Cairo rather than declared in CSS.
6. **One `text-shadow` per declaration, and no inner shadow for text.** A debossed glyph needs a dark edge above and a lit edge below, so `src/ui/engravedText.js` stacks two labels inside a `Clutter.BinLayout`: a dark copy translated up by the role's depth, and the ink copy carrying the single lit shadow. Anything that needs both cues has to be built this way.
7. **A label that is allocated even a fraction under its natural width ellipsizes**, and a `BinLayout` sizes its container from its children, so padding on the label itself is a trap: put the padding on a `St.BoxLayout` row *inside* the band and leave the measured labels unpadded. `clutter_text.ellipsize` is also pinned explicitly, because the default mode would cut a label short instead of clipping it.
11. **A control with a painted cap should not track hover at all.** St matches the Shell theme's `button:hover` and `button:focus` rules by element name, and those beat a bare class selector, so a transparent control picks up the theme's rounded blue outline as soon as the pointer crosses it. Clearing the theme's `background-gradient-*` helps but is not enough on its own, because our own hover wash would still be drawn behind the cap. `track_hover: false` takes the pseudo-class away entirely and leaves hover to the enter and leave handlers that already drive the material. Only `:focus` is styled, as the reserved border.
12. **A painted surface is faded by erasing, not by drawing.** Cairo has no mask, but `DEST_OUT` removes what is already in the buffer in proportion to the alpha it is given, which is how the header impression loses its ends without a visible edge. The operator is set for the mask and put back to `OVER` afterwards.
13. **The Shell theme styles `button:hover` and `button:focus`, and those rules beat a bare class selector.** St matches them by element name, so a control that is deliberately transparent and square picks up the theme's rounded blue outline as soon as the pointer crosses it. Every state a control has - `:hover`, `:active`, `:checked`, `:focus` - has to be restated for the extension's own classes, with the ring left to the `:focus` rule alone.
12. **A BinLayout neither applies padding nor positions a child that does not expand.** The inset that keeps content clear of a painted frame belongs on a row inside the widget, and an anchored child needs a spacer rather than an alignment.
9. **`Clutter.BinLayout` centres a child that does not expand, whatever its `x_align` says.** The meter bar has to start at the left edge of its channel, and the tray has to sit at the bottom of the card, so both are packed into a `St.BoxLayout` with a spacer that takes the remaining space rather than being positioned by alignment.
10. **A plain `St.Widget` with a `BinLayout` ignores CSS padding.** Padding is applied by the layouts that implement it (`St.BoxLayout`, `St.Bin`, `St.Button`, `St.Label`), so the inset that keeps content clear of a painted frame belongs on a row *inside* the widget, not on the widget itself.
8. **A child of a vertical `St.BoxLayout` is stretched to the full width unless it says otherwise** (`x_align` defaults to `FILL`), which turns a caption band into a full-width bar; a band that should hug its text sets `x_align: Clutter.ActorAlign.START`.
3. **The artwork must not be drawn inside a frame.** The supplied icons are complete objects; giving their buttons a plate, border or shadow doubles every edge. Keep the control material transparent and let the icon carry the depth.

## Install locally

```bash
bash scripts/install.sh
gnome-extensions enable uthy-speed-glass@uthy
```

The installer checks the installed GNOME Shell major version against metadata and installs under the user's data directory without root. The uninstall script disables the same UUID before removing only that extension directory.

## Release process

The GitHub Actions workflow validates pushes and pull requests and uploads ZIP artifacts. A matching `vMAJOR.MINOR.PATCH` tag triggers release packaging, checksum creation, generated notes, and a GitHub Release after the validation job passes. To make a release, tag the commit matching `metadata.json` and push the tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The public source repository is [uthumany/uthy-speed-glass](https://github.com/uthumany/uthy-speed-glass). GNOME Extensions website submission is a separate review process and is not implied by a GitHub release.
