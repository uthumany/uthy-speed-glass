#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT/dist}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["version-name"])' "$ROOT/metadata.json")"
ARCHIVE="$OUT_DIR/uthy-speed-glass-source-$VERSION.zip"
python3 - "$ROOT" "$ARCHIVE" <<'PY'
import pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
excluded = {'.git', 'dist', 'node_modules', '.build', '__pycache__'}
files = []
for path in root.rglob('*'):
    relative = path.relative_to(root)
    if any(part in excluded for part in relative.parts) or not path.is_file():
        continue
    files.append((relative, path))
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for relative, path in sorted(files, key=lambda item: item[0].as_posix()):
        name = pathlib.PurePosixPath('uthy-speed-glass', relative.as_posix()).as_posix()
        info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100644 & 0xFFFF) << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
print(f'PASS: full source archive ({len(files)} files)')
PY
(cd "$OUT_DIR" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")
cat "$ARCHIVE.sha256"
echo "Created: $ARCHIVE"
