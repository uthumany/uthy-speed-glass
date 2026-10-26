# Troubleshooting

## `bash: scripts/...: No such file or directory`

The command was run outside the repository. A prompt ending in `:~$` means the terminal is in your home directory, so Bash looks for `~/scripts/install.sh` rather than the script in the checkout. Change to the project folder first (the folder containing `scripts/` and `metadata.json`):

```bash
cd ~/uthy-speed-glass
ls scripts
bash scripts/install.sh
```

If the checkout is somewhere else, replace `~/uthy-speed-glass` with its actual path. If you have not cloned the source, use the prebuilt ZIP from [GitHub Releases](https://github.com/uthumany/uthy-speed-glass/releases/latest) instead. When `scripts/package.sh` could not be found, it never ran and did not create `dist/uthy-speed-glass@uthy.zip`; the later “Error opening file” and “Extension does not exist” messages are consequences of those missing files, not a separate GNOME Shell failure.

## The extension is not listed or cannot be enabled

Confirm the UUID folder is `~/.local/share/gnome-shell/extensions/uthy-speed-glass@uthy/`, `metadata.json` parses, and the installed Shell major is in the declared list (45–50). Run `gnome-extensions list` and `gnome-extensions info uthy-speed-glass@uthy`. Check Shell errors with `journalctl -f -o cat /usr/bin/gnome-shell`. If the exact installed GNOME version is outside the declared list, do not force-enable it; validate the APIs first.

## Enable/disable or reload behaves differently

On Wayland, log out and back in to restart GNOME Shell. The X11 `Alt`+`F2`, `r` reload action is not a Wayland solution. Zorin Lite uses Xfce and cannot load this GNOME extension.

## The widget shows `-- MB/s`

That is expected before a valid second counter sample. It also appears after an interface switch, counter reset, suspend gap, or while no active interface is available. Check the selected interface in preferences, `ip link`, `/proc/net/dev`, and `ip route`. Automatic detection tries NetworkManager D-Bus, then the default route and sysfs link state. If NetworkManager is absent, automatic selection still uses the local fallbacks.

## Wrong interface or stale interface

Use the expanded interface button or preferences to select `Automatic` or a visible interface. If a selected interface disappears, the monitor reports disconnected and waits; choosing another interface creates a fresh baseline and avoids a spike.

## Ping is missing or times out

Ping is off by default. When enabled, it targets only the local default gateway, requires the system `ping` utility, and runs every 10 seconds. Missing gateway, missing binary, timeout, or subprocess failure affects only latency display; RX/TX monitoring continues. Disable the setting to stop ping.

## The ZIP cannot be installed

Rebuild with `bash scripts/package.sh`, confirm `glib-compile-schemas` succeeded, and inspect the archive for `metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`, and `schemas/gschemas.compiled`. The archive checksum is stored beside the ZIP. A schema or metadata error should be corrected rather than bypassed.

## Remove the extension

Use `bash scripts/uninstall.sh` in a GNOME session with the `gnome-extensions` tool. The script disables the extension first and removes only the UUID's per-user directory. If the tool is missing, it intentionally refuses to remove files so it cannot leave an enabled extension with missing source.

## Target compatibility remains unverified

Build artifacts were prepared in Ubuntu 24.04 with GJS 1.80.2 installed for tooling, but without GNOME Shell or the GTK4/Libadwaita runtime used by the extension. Static checks cannot confirm GNOME Shell API behavior, CSS rendering, or preference-widget availability. Run the target desktop tests in [Testing](TESTING.md) before treating it as production-validated on Zorin.
