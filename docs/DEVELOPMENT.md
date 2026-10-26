# Development

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
