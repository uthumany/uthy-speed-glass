#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
MOCK_BIN="$TMP/mock-bin"
DATA_HOME="$TMP/data"
STATE="$TMP/extension-enabled"
LOG="$TMP/extension-commands.log"
mkdir -p "$MOCK_BIN" "$TMP/home"

cat > "$MOCK_BIN/gnome-shell" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == '--version' ]]; then
  echo "GNOME Shell ${MOCK_SHELL_VERSION:-46}.0"
else
  exit 2
fi
SH
cat > "$MOCK_BIN/gnome-extensions" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  list)
    if [[ "${2:-}" == '--enabled' && -f "$MOCK_EXTENSION_STATE" ]]; then
      echo 'uthy-speed-glass@uthy'
    fi
    ;;
  disable)
    echo "disable:$2" >> "$MOCK_EXTENSION_LOG"
    rm -f "$MOCK_EXTENSION_STATE"
    ;;
  enable)
    echo "enable:$2" >> "$MOCK_EXTENSION_LOG"
    : > "$MOCK_EXTENSION_STATE"
    ;;
  *) exit 2 ;;
esac
SH
chmod +x "$MOCK_BIN/gnome-shell" "$MOCK_BIN/gnome-extensions"
export HOME="$TMP/home" XDG_DATA_HOME="$DATA_HOME"
export MOCK_EXTENSION_STATE="$STATE" MOCK_EXTENSION_LOG="$LOG"
export PATH="$MOCK_BIN:$PATH"
UUID='uthy-speed-glass@uthy'
DEST="$DATA_HOME/gnome-shell/extensions/$UUID"

bash "$ROOT/scripts/install.sh" > "$TMP/install-first.log"
test -s "$DEST/extension.js"
test -s "$DEST/schemas/gschemas.compiled"

# An upgrade must replace, not merge, the old UUID directory.
printf '%s\n' stale > "$DEST/obsolete-runtime-file.js"
: > "$STATE"
mkdir -p "$DATA_HOME/gnome-shell/extensions/other-extension"
printf '%s\n' keep > "$DATA_HOME/gnome-shell/extensions/other-extension/keep.txt"
bash "$ROOT/scripts/install.sh" > "$TMP/install-upgrade.log"
test ! -e "$DEST/obsolete-runtime-file.js"
test ! -e "$STATE"
grep -Fxq "disable:$UUID" "$LOG"
test -s "$DEST/metadata.json"
test -s "$DATA_HOME/gnome-shell/extensions/other-extension/keep.txt"
if find "$DATA_HOME/gnome-shell/extensions" -maxdepth 1 -name ".$UUID.*" | grep -q .; then
  echo 'Temporary upgrade/backup directory was left behind.' >&2
  exit 1
fi

bash "$ROOT/scripts/uninstall.sh" > "$TMP/uninstall.log"
test ! -e "$DEST"
test -s "$DATA_HOME/gnome-shell/extensions/other-extension/keep.txt"

if MOCK_SHELL_VERSION=99 bash "$ROOT/scripts/install.sh" > "$TMP/unsupported.log" 2>&1; then
  echo 'Installer accepted unsupported GNOME Shell version 99.' >&2
  exit 1
fi
test ! -e "$DEST"
echo 'PASS: isolated install/upgrade/uninstall smoke test (mock GNOME commands; no desktop runtime)'
