#!/usr/bin/env bash
set -euo pipefail
UUID='uthy-speed-glass@uthy'
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA_HOME/gnome-shell/extensions/$UUID"

if [[ ! -d "$DEST" ]]; then
  echo "Extension directory not found; nothing removed: $DEST"
  exit 0
fi
if ! command -v gnome-extensions >/dev/null 2>&1; then
  echo 'gnome-extensions is unavailable. Nothing removed; run this from a GNOME session with the extension CLI so it can be disabled safely first.' >&2
  exit 1
fi

if gnome-extensions list --enabled 2>/dev/null | grep -Fxq "$UUID"; then
  gnome-extensions disable "$UUID"
fi
rm -rf -- "$DEST"
echo "Disabled (when enabled) and removed only: $DEST"
