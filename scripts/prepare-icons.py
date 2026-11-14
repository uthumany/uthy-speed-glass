#!/usr/bin/env python3
"""Prepare the supplied SVG icon set for the extension.

The sources in `assets/icons-source/` are traced artwork. Two of them
(`Close.svg`, `minus.svg`) also carry the flat plate and hairline border of the
bitmap they were traced from, which reads as a frame around the icon once it is
drawn on the glass surface. This script removes that frame, trims each icon to
its artwork, scales every icon to the same visual weight and writes the PNGs
the extension loads at runtime.

Steps per icon:

1. render the source SVG at high resolution,
2. flood fill the background from the canvas border (transparent pixels and the
   flat near-white plate),
3. drop any remaining component that spans the whole canvas, is almost empty
   and hugs the canvas edge - that is a frame ring, never artwork,
4. trim to the artwork, centre it on a square canvas and scale it so the
   artwork fills a fixed share of the canvas,
5. downscale to the shipped size.

The output is deterministic, so the generated files can be reviewed and
committed. Run from the repository root:

    python3 scripts/prepare-icons.py

Requires `rsvg-convert` (Debian/Ubuntu package `librsvg2-bin`) and Pillow.
"""
from __future__ import annotations

import pathlib
import shutil
import subprocess
import sys
import tempfile
from collections import deque

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - environment
    sys.exit(f"This script needs Pillow: {error}")

if shutil.which("rsvg-convert") is None:  # pragma: no cover - environment
    sys.exit("This script needs rsvg-convert (librsvg2-bin)")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "assets" / "icons-source"
OUT_DIR = ROOT / "icons"

RENDER_SIZE = 256
SHIPPED_SIZE = 96
INK_SHARE = 0.88
ALPHA_FLOOR = 16
PLATE_MIN_CHANNEL = 230
FRAME_SPAN = 0.92
FRAME_FILL = 0.25
FRAME_EDGE_BAND = 0.06

# Output name -> source file in assets/icons-source.
ICONS = {
    "brand": "app_logo_icon.svg",
    "notification": "Bell-Notification.svg",
    "close": "Close.svg",
    "minimize": "minus.svg",
    "pause": "Pause.svg",
    "play": "play.svg",
    "refresh": "Reload.svg",
    "pin": "pin.svg",
    "pin-locked": "pinned.svg",
    "expand": "chevron-down.svg",
    "settings": "setting.svg",
    "share": "share.svg",
    "download": "download-speed.svg",
    "upload": "upload-speed.svg",
}


def render(source: pathlib.Path) -> Image.Image:
    """Render an SVG to a square RGBA image at RENDER_SIZE."""
    with tempfile.TemporaryDirectory() as directory:
        rendered = pathlib.Path(directory) / "icon.png"
        subprocess.run(
            ["rsvg-convert", "--width", str(RENDER_SIZE), "--height", str(RENDER_SIZE),
             "--output", str(rendered), str(source)],
            check=True,
        )
        return Image.open(rendered).convert("RGBA")


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    """Transparent pixel or flat near-white plate."""
    red, green, blue, alpha = pixel
    if alpha < ALPHA_FLOOR:
        return True
    return min(red, green, blue) > PLATE_MIN_CHANNEL


def clear_background(image: Image.Image) -> None:
    """Flood fill the border-connected background to full transparency."""
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    queue = deque()

    def push(x: int, y: int) -> None:
        index = y * width + x
        if seen[index]:
            return
        seen[index] = 1
        if is_background(pixels[x, y]):
            pixels[x, y] = (0, 0, 0, 0)
            queue.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                push(next_x, next_y)


def components(image: Image.Image) -> list[dict]:
    """Connected components of visible pixels, with their bounds and density."""
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    found = []
    for start_y in range(height):
        for start_x in range(width):
            index = start_y * width + start_x
            if seen[index] or pixels[start_x, start_y][3] < ALPHA_FLOOR:
                continue
            queue = deque([(start_x, start_y)])
            seen[index] = 1
            count = 0
            min_x = max_x = start_x
            min_y = max_y = start_y
            deepest = min(start_x, start_y, width - 1 - start_x, height - 1 - start_y)
            while queue:
                x, y = queue.popleft()
                count += 1
                min_x, max_x = min(min_x, x), max(max_x, x)
                min_y, max_y = min(min_y, y), max(max_y, y)
                deepest = max(deepest, min(x, y, width - 1 - x, height - 1 - y))
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height:
                        neighbour = next_y * width + next_x
                        if not seen[neighbour] and pixels[next_x, next_y][3] >= ALPHA_FLOOR:
                            seen[neighbour] = 1
                            queue.append((next_x, next_y))
            found.append({
                "count": count,
                "bounds": (min_x, min_y, max_x + 1, max_y + 1),
                "deepest_pixel": deepest,
            })
    return found


def strip_frames(image: Image.Image) -> int:
    """Erase frame rings: empty components that hug the canvas edge.

    A square plate border leaves a ring that runs parallel to the canvas edge
    a pixel or two inside it. A round outline such as the expand chevron also
    spans the canvas and is thin, but most of its pixels sit far from the edge,
    so the edge distance keeps it.
    """
    width, height = image.size
    pixels = image.load()
    removed = 0
    for component in components(image):
        min_x, min_y, max_x, max_y = component["bounds"]
        span_x = (max_x - min_x) / width
        span_y = (max_y - min_y) / height
        density = component["count"] / max(1, (max_x - min_x) * (max_y - min_y))
        hugs_edge = component["deepest_pixel"] <= FRAME_EDGE_BAND * max(width, height)
        if span_x > FRAME_SPAN and span_y > FRAME_SPAN and density < FRAME_FILL and hugs_edge:
            for y in range(min_y, max_y):
                for x in range(min_x, max_x):
                    if pixels[x, y][3] >= ALPHA_FLOOR:
                        pixels[x, y] = (0, 0, 0, 0)
            removed += 1
    return removed


def normalise(image: Image.Image) -> Image.Image:
    """Trim to the artwork and scale it to a fixed share of a square canvas."""
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        return image
    artwork = image.crop(bounds)
    side = max(artwork.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        artwork,
        ((side - artwork.width) // 2, (side - artwork.height) // 2),
        artwork,
    )
    target = max(1, round(side / INK_SHARE))
    square = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    square.paste(canvas, ((target - side) // 2, (target - side) // 2), canvas)
    return square


def main() -> int:
    if not SOURCE_DIR.is_dir():
        sys.exit(f"Missing icon sources: {SOURCE_DIR}")
    OUT_DIR.mkdir(exist_ok=True)
    missing = [name for name in ICONS.values() if not (SOURCE_DIR / name).is_file()]
    if missing:
        sys.exit(f"Missing source icons: {', '.join(missing)}")

    for output_name, source_name in sorted(ICONS.items()):
        image = render(SOURCE_DIR / source_name)
        clear_background(image)
        frames = strip_frames(image)
        image = normalise(image)
        image = image.resize((SHIPPED_SIZE, SHIPPED_SIZE), Image.LANCZOS)
        destination = OUT_DIR / f"{output_name}.png"
        image.save(destination, optimize=True)
        note = f", removed {frames} frame component(s)" if frames else ""
        print(f"{destination.name:20s} from {source_name}{note}")

    # The prepared set replaces the generated SVG icons entirely.
    for stale in OUT_DIR.glob("*.svg"):
        stale.unlink()
        print(f"removed stale {stale.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
