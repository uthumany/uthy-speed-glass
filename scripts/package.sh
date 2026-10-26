#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID='uthy-speed-glass@uthy'
OUT_DIR="${1:-$ROOT/dist}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
STAGE="$TEMP/$UUID"
mkdir -p "$STAGE"
cp -a "$ROOT/extension.js" "$ROOT/prefs.js" "$ROOT/metadata.json" "$ROOT/stylesheet.css" "$STAGE/"
cp -a "$ROOT/src" "$ROOT/schemas" "$STAGE/"
cp -a "$ROOT/LICENSE" "$STAGE/" 2>/dev/null || true
glib-compile-schemas --strict "$STAGE/schemas"

ARCHIVE="$OUT_DIR/$UUID.zip"
PACKER_USED=0
if command -v gnome-extensions >/dev/null 2>&1 && gnome-extensions pack --help 2>&1 | grep -q -- '--out-dir'; then
  # Validate with the GNOME packer when available; canonicalize below for reproducible timestamps.
  mkdir -p "$TEMP/gnome-pack"
  PACKED="$TEMP/gnome-pack/$UUID.zip"
  if gnome-extensions pack --force --out-dir "$TEMP/gnome-pack" "$STAGE" >/dev/null 2>&1 && [[ -s "$PACKED" ]]; then
    PACKER_USED=1
  else
    echo 'GNOME pack command was unavailable or failed; using the deterministic ZIP builder.' >&2
  fi
fi

python3 - "$STAGE" "$ARCHIVE" <<'PY'
import pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(p for p in source.rglob('*') if p.is_file()):
        relative = path.relative_to(source).as_posix()
        info = zipfile.ZipInfo(relative, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100644 & 0xFFFF) << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
PY
if [[ "$PACKER_USED" == 1 ]]; then
  echo 'PASS: GNOME extension packer accepted the staged extension; canonical ZIP timestamps normalized.'
else
  echo 'INFO: GNOME packer not available; deterministic ZIP fallback used.'
fi

(cd "$OUT_DIR" && sha256sum "$UUID.zip" > "$UUID.zip.sha256")
cat "$ARCHIVE.sha256"
python3 - "$ARCHIVE" <<'PY'
import pathlib, sys, zipfile
archive = zipfile.ZipFile(sys.argv[1])
names = set(archive.namelist())
required = {'metadata.json', 'extension.js', 'prefs.js', 'stylesheet.css', 'schemas/gschemas.compiled', 'schemas/org.gnome.shell.extensions.uthyspeedglass.gschema.xml'}
missing = required - names
if missing:
    raise SystemExit(f'Package missing required paths: {sorted(missing)}')
if any(name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts for name in names):
    raise SystemExit('Package contains unsafe paths')
print(f'PASS: package layout ({len(names)} files)')
PY
echo "Created: $ARCHIVE"
