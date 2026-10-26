# Testing and acceptance report

## Automated results from this build

| Check | Result | Evidence |
|---|---|---|
| Metadata UUID, version, shell list, and schema ID consistency | PASS | `scripts/validate.sh` Python validation |
| GSettings XML structure and required keys | PASS | XML parsed and required keys checked |
| Strict GSettings schema compilation | PASS | `glib-compile-schemas --strict` to a temporary directory |
| GSettings runtime schema loading | PASS | All 19 keys and expected defaults read with `gsettings` using the memory backend |
| JavaScript syntax | PASS | Node.js syntax check for 18 `.js` source/test files; this is not a GJS import/runtime test |
| Unit tests | PASS | 11 passing tests across counter parsing, route parsing, throughput, reset/baseline behavior, totals, averages, peaks, and formatting |
| Installer/upgrade/uninstaller smoke test | PASS | Runs against a temporary data directory and mocked `gnome-shell`/`gnome-extensions` commands; verifies old files are pruned, unrelated directories remain, and unsupported versions are refused |
| Bash syntax | PASS | `bash -n` on all scripts |
| ShellCheck | PASS | `shellcheck` installed in the Ubuntu sandbox and run by `scripts/validate.sh` |
| Package ZIP layout and compiled schema | PASS | Package script verifies mandatory archive entries and safe relative paths |
| Full-source archive and checksums | PASS | Source ZIP contains the project files; both relative-path SHA-256 checks verified |
| Physical Zorin OS 18.1 GNOME Shell operation | NOT TESTED | Build environment is Ubuntu 24.04 with GJS 1.80.2 installed but without GNOME Shell or the target desktop |
| Preferences rendering with target GTK4/Libadwaita | NOT TESTED | No GTK4/Libadwaita preferences runtime or target GNOME desktop available |
| Wayland/X11 interaction | NOT TESTED | Build container session is not the Zorin target desktop |
| Multiple monitors, display scaling, accessibility/keyboard focus, reduced motion | NOT TESTED | Requires live GNOME desktop testing |
| NetworkManager D-Bus active-device discovery | NOT TESTED | No NetworkManager client or GNOME runtime available here |
| Optional ping subprocess | NOT TESTED | Requires GJS/Gio runtime and a local gateway |
| Install/uninstall against a real user's GNOME session | NOT TESTED | Would modify the target desktop and was not run |
| GitHub Actions release automation | CONFIGURED | Pushes trigger validation; matching version tags publish ZIPs and checksums only after validation succeeds |
| GNOME Extensions review/approval | NOT TESTED | No submission was made |

The local test output is reproducible with `bash scripts/validate.sh`, `bash scripts/package.sh`, and `bash scripts/package-source.sh`. `dist/` contains the generated installable ZIP, full-source ZIP, and their checksums after packaging.

Known implementation limit: optional gateway ping currently discovers only IPv4 default routes from `/proc/net/route`; IPv6-only ping is not supported. Traffic counters can still be read for any manually selected interface.

## Functional tests to perform on Zorin

1. Install through the script, enable the extension, and confirm both rates initially show `-- MB/s` before a second sample.
2. Generate known local RX/TX traffic and compare displayed rates with byte-counter deltas over the same sampling interval; verify decimal MB/s, not Mbps.
3. Test automatic choice and each visible interface, including wired, Wi-Fi, USB tethering, and virtual interfaces where present.
4. Disconnect, reconnect, change interface, pause/resume, and suspend/resume; ensure each transition returns through a fresh baseline without a spike.
5. Check zero traffic, counter reset, missing interface, missing NetworkManager, unavailable `ping`, missing route, ping timeout, and extension disable while a ping is active.
6. Check mini/compact/expanded/minimized/hidden flows, drag/pin/resize, interface cycling, pause/resume, reset, preferences, and re-show from the panel menu.
7. Verify GSettings persistence after logout/login and after preferences close/reopen.
8. Check small screens, fractional scaling, light/dark wallpapers, at least two monitors, monitor removal, keyboard navigation/focus, and reduced motion.
9. Disable/re-enable and confirm no duplicate timer, actors, D-Bus signal, or subprocess remains.
10. Install/uninstall in both X11 and Wayland sessions; verify no unrelated extensions or settings changed.

## Acceptance interpretation

A complete static build and passing deterministic tests do not establish the full runtime acceptance criteria. In particular, St/Cairo rendering, GNOME Shell API compatibility, actual widget interaction, and preferences availability must be verified on the target Zorin image before calling this production-validated.
