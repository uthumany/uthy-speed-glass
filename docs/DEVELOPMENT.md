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

The runtime ZIP carries `icons/`, because the toolbar loads those assets at run time. `package.sh` fails if the staged archive has no bundled icon.

## Regenerate the 3D icon set

`icons/` is generated output, not hand-drawn art. Every control icon is built from the same light model by `scripts/generate-icons.py`:

```bash
python3 scripts/generate-icons.py
```

The script is deterministic, needs only the Python standard library, and should be run after any change to the light model, the gradient or a glyph. Review the result at its true render size before committing; `librsvg2-bin` provides `rsvg-convert` if you want a quick preview:

```bash
rsvg-convert -w 16 -h 16 icons/refresh-symbolic.svg -o /tmp/refresh.png
```

St renders these SVGs through `Gio.FileIcon`. If an asset is missing at run time the icon factory falls back to the matching symbolic icon from the user's theme, so a partial install still shows a usable toolbar.

Two St behaviours were established by rendering the set inside a nested Shell and must be respected by any new glyph:

1. **St.Icon defaults to symbolic style**, which flattens an icon into a monochrome mask and discards baked shading. The `uthy-3d-icon` class sets `-st-icon-style: regular` so the pre-shaded assets keep their lighting; the symbolic fallback deliberately keeps the default so the theme icon is tinted by the CSS colour.
2. **An open arc path that is stroked is filled as well as stroked.** The attribute `fill="none"` is not honoured reliably when it comes from a wrapping group, and for an almost-closed arc the extra fill covers the hole. Build such glyphs from filled shapes instead: the refresh ring is a filled annulus sector with a separate solid arrowhead, and the padlock shackle is a closed arch. Verify any new glyph inside a nested session at 16 px before committing.

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
