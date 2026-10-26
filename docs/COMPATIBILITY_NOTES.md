# Compatibility notes and sources

The requested target is Zorin OS 18.1 Core. The build computer is a separate Ubuntu 24.04.4 LTS sandbox with GJS 1.80.2 installed for tooling, but no GNOME Shell, GTK4/Libadwaita preferences runtime, or NetworkManager command-line client. Therefore it was not possible to read the target machine's actual GNOME Shell/GJS versions or run a desktop integration test.

Zorin's official technical details identify Zorin OS 18.1 as based on Ubuntu 24.04 LTS and list GNOME Shell for the Core and Pro editions. The page does not specify the exact GNOME Shell minor version. Source: [Zorin OS technical details](https://zorin.com/os/details/).

The extension uses the GNOME 45-and-later ES-module architecture. The official GJS extension anatomy guide states that GNOME Shell and extensions use ES modules starting with GNOME 45, and documents `shell-version` as a list of GNOME Shell major-version strings. Source: [GJS Guide — Anatomy of an Extension](https://gjs.guide/extensions/overview/anatomy.html).

Preferences use `ExtensionPreferences` with GTK4/Libadwaita in a process separate from the Shell runtime. The GJS Guide's preferences documentation states that the modern preferences process uses GTK4 and Adwaita and should not import Shell, Meta, Clutter, or St. Source: [GJS Guide — Preferences](https://gjs.guide/extensions/development/preferences.html).

The package declares GNOME Shell 45–50 in `metadata.json`; this is an implementation compatibility declaration, not evidence that each version has been runtime-tested. The installation script checks the actual installed Shell major against that list before installing. Validate the target with `gnome-shell --version`, `gjs --version`, and live interaction tests before public distribution. Zorin OS Lite is Xfce and is not supported by a GNOME Shell extension.
