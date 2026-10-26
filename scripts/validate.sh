#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for command_name in python3 node glib-compile-schemas; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "FAIL: required validation command not found: $command_name" >&2
    exit 1
  fi
done

python3 - "$ROOT" <<'PY'
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET
root = pathlib.Path(sys.argv[1])
metadata = json.loads((root / 'metadata.json').read_text())
expected_uuid = 'uthy-speed-glass@uthy'
expected_schema = 'org.gnome.shell.extensions.uthyspeedglass'
assert metadata.get('uuid') == expected_uuid, 'metadata UUID mismatch'
assert metadata.get('settings-schema') == expected_schema, 'settings schema mismatch'
assert metadata.get('name') == 'Uthy Speed Glass', 'name mismatch'
assert isinstance(metadata.get('version'), int) and metadata['version'] >= 1, 'invalid extension version'
assert re.fullmatch(r'\d+\.\d+\.\d+', metadata.get('version-name', '')), 'invalid semantic version-name'
shell_versions = metadata.get('shell-version')
assert isinstance(shell_versions, list) and shell_versions, 'shell-version list must be non-empty'
assert all(isinstance(item, str) and item.isdigit() for item in shell_versions), 'invalid shell-version list'
schema_file = root / 'schemas' / f'{expected_schema}.gschema.xml'
schema = ET.parse(schema_file).getroot().find('schema')
assert schema is not None and schema.attrib.get('id') == expected_schema, 'GSettings schema ID mismatch'
keys = {key.attrib['name'] for key in schema.findall('key')}
required = {'refresh-interval', 'interface', 'display-mode', 'show-graphs', 'show-widget', 'remember-position', 'widget-x', 'widget-y', 'widget-width', 'widget-height', 'pinned', 'transparency', 'download-color', 'upload-color', 'font-size', 'corner-radius', 'graph-height', 'reduce-motion', 'ping-enabled'}
assert required <= keys, f'missing schema keys: {sorted(required - keys)}'
assert (root / 'extension.js').is_file(), 'missing extension.js'
assert (root / 'prefs.js').is_file(), 'missing prefs.js'
print('PASS: metadata and GSettings schema structure')
PY

glib-compile-schemas --strict --targetdir "$TMP" "$ROOT/schemas"
test -s "$TMP/gschemas.compiled"
echo 'PASS: strict GSettings schema compilation'
if command -v gsettings >/dev/null 2>&1; then
  key_count="$(GSETTINGS_SCHEMA_DIR="$TMP" GSETTINGS_BACKEND=memory gsettings list-keys org.gnome.shell.extensions.uthyspeedglass | wc -l)"
  [[ "$key_count" -eq 19 ]]
  [[ "$(GSETTINGS_SCHEMA_DIR="$TMP" GSETTINGS_BACKEND=memory gsettings get org.gnome.shell.extensions.uthyspeedglass refresh-interval)" == '1000' ]]
  [[ "$(GSETTINGS_SCHEMA_DIR="$TMP" GSETTINGS_BACKEND=memory gsettings get org.gnome.shell.extensions.uthyspeedglass interface)" == "'auto'" ]]
  echo 'PASS: GSettings loads all 19 keys and expected defaults using the memory backend'
else
  echo 'NOT TESTED: gsettings command is not installed'
fi

mapfile -t js_files < <(find "$ROOT" -type f -name '*.js' -not -path '*/node_modules/*' | sort)
for js_file in "${js_files[@]}"; do
  node --check "$js_file" >/dev/null
done
echo "PASS: JavaScript syntax (${#js_files[@]} files via Node.js; not a GJS runtime test)"

node --test "$ROOT"/tests/*.test.js
bash "$ROOT/tests/install-scripts.test.sh"

echo '--- Shell script checks ---'
for shell_file in "$ROOT"/scripts/*.sh; do
  bash -n "$shell_file"
done
bash -n "$ROOT"/tests/*.sh
echo 'PASS: bash -n for installation, validation, packaging, and removal scripts'
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck "$ROOT"/scripts/*.sh
  echo 'PASS: ShellCheck'
else
  echo 'NOT TESTED: ShellCheck (not installed)'
fi

echo 'NOT TESTED: GNOME Shell/GJS runtime, GTK4 preferences rendering, Wayland/X11 interaction, multi-monitor behavior, and physical Zorin OS 18.1 integration'
