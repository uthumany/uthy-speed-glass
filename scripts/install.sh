#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID='uthy-speed-glass@uthy'
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA_HOME/gnome-shell/extensions/$UUID"
PARENT="$(dirname "$DEST")"

for command_name in python3 glib-compile-schemas gnome-shell; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name. Nothing installed." >&2
    exit 1
  fi
done

SHELL_VERSION="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"
if [[ -z "$SHELL_VERSION" ]]; then
  echo 'Could not determine GNOME Shell version. Nothing installed.' >&2
  exit 1
fi
if ! python3 - "$ROOT/metadata.json" "$SHELL_VERSION" <<'PY'
import json, sys
metadata = json.load(open(sys.argv[1], encoding='utf-8'))
if sys.argv[2] not in metadata.get('shell-version', []):
    print(f"GNOME Shell {sys.argv[2]} is not declared supported by this extension.", file=sys.stderr)
    raise SystemExit(1)
PY
then
  exit 1
fi

mkdir -p "$PARENT"
if [[ -e "$DEST" || -L "$DEST" ]] && ! command -v gnome-extensions >/dev/null 2>&1; then
  echo 'An existing install was found but gnome-extensions is unavailable; refusing an unsafe in-place upgrade.' >&2
  exit 1
fi
STAGE="$(mktemp -d "$PARENT/.${UUID}.install.XXXXXX")"
BACKUP=''
WAS_ENABLED=0
INSTALL_COMMITTED=0
cleanup() {
  if [[ -d "$STAGE" ]]; then
    rm -rf -- "$STAGE"
  fi
  if [[ "$INSTALL_COMMITTED" == 0 ]]; then
    if [[ -n "$BACKUP" && ( -e "$BACKUP" || -L "$BACKUP" ) ]]; then
      if [[ ! -e "$DEST" && ! -L "$DEST" ]]; then
        mv -- "$BACKUP" "$DEST"
        BACKUP=''
      else
        rm -rf -- "$BACKUP"
        BACKUP=''
      fi
    fi
    if [[ "$WAS_ENABLED" == 1 && ( -e "$DEST" || -L "$DEST" ) ]]; then
      gnome-extensions enable "$UUID" || echo 'Warning: restored the old files but could not re-enable the extension.' >&2
    fi
  elif [[ -n "$BACKUP" && ( -e "$BACKUP" || -L "$BACKUP" ) ]]; then
      rm -rf -- "$BACKUP"
  fi
}
trap cleanup EXIT

cp -a "$ROOT/extension.js" "$ROOT/prefs.js" "$ROOT/metadata.json" "$ROOT/stylesheet.css" "$STAGE/"
cp -a "$ROOT/src" "$ROOT/schemas" "$ROOT/icons" "$STAGE/"
cp -a "$ROOT/LICENSE" "$STAGE/" 2>/dev/null || true
glib-compile-schemas --strict "$STAGE/schemas"

if [[ -e "$DEST" || -L "$DEST" ]]; then
  if gnome-extensions list --enabled 2>/dev/null | grep -Fxq "$UUID"; then
    gnome-extensions disable "$UUID"
    WAS_ENABLED=1
  fi
  BACKUP="$(mktemp -d "$PARENT/.${UUID}.backup.XXXXXX")"
  rmdir -- "$BACKUP"
  mv -- "$DEST" "$BACKUP"
fi
if ! mv -- "$STAGE" "$DEST"; then
  echo 'Installation failed; restoring the previous extension directory if one existed.' >&2
  exit 1
fi
INSTALL_COMMITTED=1

echo "Installed per-user at: $DEST"
echo "GNOME Shell detected: $SHELL_VERSION"
if [[ "${XDG_SESSION_TYPE:-unknown}" == 'wayland' ]]; then
  echo 'Wayland session: enable the extension in Extensions/Extension Manager; restarting GNOME Shell generally requires logging out and back in.'
fi
if command -v gnome-extensions >/dev/null 2>&1; then
  echo "Enable with: gnome-extensions enable $UUID"
else
  echo "Enable $UUID using the GNOME Extensions app or Extension Manager."
fi
