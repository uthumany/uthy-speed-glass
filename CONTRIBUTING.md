# Contributing

Thanks for helping improve Uthy Speed Glass. Keep changes focused, reviewable, and compatible with the declared GNOME Shell range.

## Before opening a pull request

1. Read [Architecture](docs/ARCHITECTURE.md) and [Testing](docs/TESTING.md).
2. Keep preferences in `prefs.js` and Shell actors in runtime modules; do not import Shell, St, Meta, or Clutter into the preferences process.
3. Keep counter parsing, speed calculation, and statistics deterministic and unit tested.
4. Ensure every timer, signal, actor, cancellable, and subprocess has a matching teardown path.
5. Run `bash scripts/validate.sh` and `bash scripts/package.sh`.
6. Report any target GNOME desktop checks you ran separately from static tests.

Avoid network APIs, telemetry, credentials, root-only installation, and interface-derived shell command strings. Keep graph data bounded and preserve a clean baseline after disconnects, resets, and resume. Do not add UI controls unless their actions are fully implemented.

Use conventional, concise commit subjects. Pull requests should state behavior changes, compatibility impact, tests run, tests not run, and any screenshot captured on an actual GNOME session. Do not claim a target platform is supported based only on JavaScript syntax checks.
