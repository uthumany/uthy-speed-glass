#!/usr/bin/env python3
"""Generate the bundled 3D skeuomorphic icon set.

Every icon in the set shares one light model so the toolbar reads as a
single material:

* key light from the upper left,
* an embossed contact shadow offset below the glyph,
* a cool specular bevel on the upper edge,
* a face gradient that falls from white to a cool shadow tone.

The output is deterministic, so the generated files can be reviewed and
committed. Run from the repository root:

    python3 scripts/generate-icons.py
"""

from __future__ import annotations

import math
import pathlib
import re

SIZE = 24
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "icons"

SHADOW_COLOR = "#04101F"
SHADOW_OPACITY = "0.55"
SHADOW_OFFSET = 0.9

FACE_STOPS = (
    ("0", "#FFFFFF", "1"),
    ("0.5", "#E6F0FF", "1"),
    ("1", "#A6BFE2", "1"),
)

BEVEL_COLOR = "#FFFFFF"
BEVEL_OPACITY = "0.45"
BEVEL_WIDTH = "0.55"


def _gradient() -> str:
    stops = "".join(
        f'<stop offset="{offset}" stop-color="{color}" stop-opacity="{opacity}"/>'
        for offset, color, opacity in FACE_STOPS
    )
    # User-space coordinates keep the light direction identical for filled
    # shapes and for zero-area strokes such as straight lines.
    return (
        '<linearGradient id="face" gradientUnits="userSpaceOnUse" '
        'x1="3.6" y1="1.2" x2="20.4" y2="22.8">'
        f"{stops}</linearGradient>"
    )


def _svg(label: str, body: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" '
        f'viewBox="0 0 {SIZE} {SIZE}" role="img" aria-label="{label}">'
        f"<defs>{_gradient()}</defs>{body}</svg>\n"
    )


def _layers(face: str, bevel: str = "", filled: bool = True) -> str:
    """Stack the contact shadow, the lit face and an optional specular bevel."""
    shadow = (
        f'<g transform="translate(0,{SHADOW_OFFSET})" fill="{SHADOW_COLOR}" '
        f'fill-opacity="{SHADOW_OPACITY}" stroke="{SHADOW_COLOR}" '
        f'stroke-opacity="{SHADOW_OPACITY}">{face}</g>'
    )
    lit = f'<g fill="url(#face)" stroke="url(#face)">{face}</g>'
    specular = ""
    if filled and bevel:
        specular = (
            f'<g stroke="{BEVEL_COLOR}" stroke-opacity="{BEVEL_OPACITY}" '
            f'stroke-width="{BEVEL_WIDTH}" stroke-linecap="round" '
            f'stroke-linejoin="round">{_stroke_only(bevel)}</g>'
        )
    return shadow + lit + specular


def _stroke_only(markup: str) -> str:
    """Force every shape in `markup` to be stroked only.

    The attribute is written on each element rather than on a wrapping group
    because GNOME Shell's SVG renderer ignores an inherited `fill="none"` and
    would otherwise fill the shape as well as stroke it.
    """
    pattern = re.compile(r"<(?:rect|circle|path|polygon|line)\b[^>]*>")

    def add_fill(match: "re.Match[str]") -> str:
        tag = match.group(0)
        if "fill=" in tag:
            return tag
        closing = "/>" if tag.endswith("/>") else ">"
        return f'{tag[: -len(closing)].rstrip()} fill="none"{closing}'

    return pattern.sub(add_fill, markup)


def _circle(cx: float, cy: float, r: float) -> str:
    return f'<circle cx="{cx}" cy="{cy}" r="{r}"/>'


def _rect(x: float, y: float, w: float, h: float, radius: float) -> str:
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}"/>'


def _path(d: str) -> str:
    return f'<path d="{d}"/>'


def _stroke_path(d: str, width: float) -> str:
    """A stroked path.

    `fill="none"` is repeated on the element itself because GNOME Shell's SVG
    renderer does not honour the attribute when it is inherited from a
    wrapping group; without it the path is filled as well as stroked, which
    turns a ring into a solid disc.
    """
    return f'<path d="{d}" fill="none" stroke-width="{width}"/>'


def _line(x1: float, y1: float, x2: float, y2: float, width: float) -> str:
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke-width="{width}" '
        'stroke-linecap="round" fill="none"/>'
    )


def pin() -> str:
    head = _rect(7.6, 3.8, 8.8, 6.6, 2.6)
    needle = _line(12, 10.2, 12, 18.6, 2.0)
    foot = _line(8.6, 19.6, 15.4, 19.6, 1.9)
    return _layers(head + needle + foot, bevel=head, filled=True)


def pin_locked() -> str:
    # The shackle is a closed arch rather than a stroked arc: GNOME Shell's
    # SVG renderer fills open arc paths, which would smear it into a blob.
    shackle = _path("M8.6 10.8V8.4a3.4 3.4 0 0 1 6.8 0v2.4Z")
    body = _rect(6.4, 10.1, 11.2, 9.4, 2.8)
    keyhole = _circle(12, 14.4, 1.5)
    return _layers(
        f"{shackle}{body}{keyhole}",
        bevel=body,
        filled=True,
    )


def minimize() -> str:
    bar = _rect(6.8, 14.9, 10.4, 1.9, 0.95)
    return _layers(bar, bevel=bar, filled=True)


def expand() -> str:
    chevron = _stroke_path("M7.4 10.4 12 15 16.6 10.4", 2.1)
    return _layers(
        f'<g stroke-linecap="round" stroke-linejoin="round">{chevron}</g>',
        filled=False,
    )


def close() -> str:
    cross = _line(8.2, 8.2, 15.8, 15.8, 2.1) + _line(15.8, 8.2, 8.2, 15.8, 2.1)
    return _layers(
        f'<g stroke-linecap="round">{cross}</g>',
        filled=False,
    )


def pause() -> str:
    left = _rect(8.1, 6.6, 2.6, 10.8, 1.3)
    right = _rect(13.3, 6.6, 2.6, 10.8, 1.3)
    return _layers(left + right, bevel=left + right, filled=True)


def play() -> str:
    triangle = _path("M9.4 6.9 17.4 12 9.4 17.1Z")
    return _layers(
        f'<g stroke-width="2.4" stroke-linejoin="round">{triangle}</g>',
        bevel=triangle,
        filled=True,
    )


def refresh() -> str:
    """A refresh ring drawn as a filled annulus sector plus a solid head.

    Stroking is avoided on purpose: GNOME Shell's SVG renderer does not
    reliably honour `fill="none"` for open arc paths and fills them instead,
    which turns the ring into a solid disc. A filled ring and a filled head
    render identically everywhere and stay legible when scaled to 16 px.
    """
    centre, outer_radius, inner_radius = 12.0, 8.6, 6.6
    start_degrees, end_degrees = -30.0, 280.0

    def point(radius: float, degrees: float) -> tuple[float, float]:
        radians = math.radians(degrees)
        return (centre + radius * math.cos(radians), centre + radius * math.sin(radians))

    def fmt(spot: tuple[float, float]) -> str:
        return f"{spot[0]:.2f} {spot[1]:.2f}"

    outer_start, outer_end = point(outer_radius, start_degrees), point(outer_radius, end_degrees)
    inner_start, inner_end = point(inner_radius, start_degrees), point(inner_radius, end_degrees)
    ring = _path(
        f"M{fmt(outer_start)} "
        f"A{outer_radius} {outer_radius} 0 1 1 {fmt(outer_end)} "
        f"L{fmt(inner_end)} "
        f"A{inner_radius} {inner_radius} 0 1 0 {fmt(inner_start)} Z"
    )

    radians = math.radians(end_degrees)
    tangent = (-math.sin(radians), math.cos(radians))
    normal = (math.cos(radians), math.sin(radians))
    tip = (outer_end[0] + 3.6 * tangent[0], outer_end[1] + 3.6 * tangent[1])
    base_one = (outer_end[0] + 2.7 * normal[0], outer_end[1] + 2.7 * normal[1])
    base_two = (outer_end[0] - 2.7 * normal[0], outer_end[1] - 2.7 * normal[1])
    head = _path(f"M{fmt(tip)} L{fmt(base_one)} L{fmt(base_two)} Z")

    return _layers(f"{ring}{head}", bevel=ring, filled=True)


def settings() -> str:
    """A gear built from a bevelled ring, rounded teeth and a cut-out hub."""
    teeth = 8
    tooth_markup = ""
    for index in range(teeth):
        angle = math.pi * 2 * index / teeth - math.pi / 2
        inner_x = 12 + 7.0 * math.cos(angle)
        inner_y = 12 + 7.0 * math.sin(angle)
        outer_x = 12 + 9.4 * math.cos(angle)
        outer_y = 12 + 9.4 * math.sin(angle)
        tooth_markup += _line(inner_x, inner_y, outer_x, outer_y, 2.6)
    ring = _path(
        "M12 4.0a8.0 8.0 0 1 1 0 16.0 8.0 8.0 0 0 1 0-16.0Z"
        "M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"
    )
    return _layers(
        f'<g fill-rule="evenodd">{tooth_markup}{ring}</g>',
        bevel=ring,
        filled=True,
    )


def download() -> str:
    stem = _line(12, 4.6, 12, 13.4, 2.2)
    head = _stroke_path("M7.9 9.9 12 14 16.1 9.9", 2.2)
    tray = _line(7.4, 18.4, 16.6, 18.4, 2.0)
    return _layers(
        f'<g stroke-linecap="round" stroke-linejoin="round">{stem}{head}</g>{tray}',
        filled=False,
    )


def upload() -> str:
    stem = _line(12, 19.4, 12, 10.6, 2.2)
    head = _stroke_path("M7.9 14.1 12 10 16.1 14.1", 2.2)
    tray = _line(7.4, 5.6, 16.6, 5.6, 2.0)
    return _layers(
        f'<g stroke-linecap="round" stroke-linejoin="round">{stem}{head}</g>{tray}',
        filled=False,
    )


def network() -> str:
    nodes = _circle(12, 6.1, 2.5) + _circle(6.5, 17.2, 2.5) + _circle(17.5, 17.2, 2.5)
    links = _line(10.9, 8.1, 7.3, 15.3, 1.9) + _line(13.1, 8.1, 16.7, 15.3, 1.9)
    return _layers(
        f"{nodes}<g>{links}</g>",
        bevel=nodes,
        filled=True,
    )


def droplet() -> str:
    body = _path(
        "M12 3.2C12 3.2 5.9 10.4 5.9 14.4a6.1 6.1 0 0 0 12.2 0C18.1 10.4 12 3.2 12 3.2Z"
    )
    # A closed crescent instead of a stroked arc, for the same reason as the
    # refresh ring.
    highlight = _path("M9.6 13.4a2.9 2.9 0 0 0 2.5 3.6a3.4 3.4 0 0 1-2.5-3.6Z")
    return _layers(
        f'<g stroke-width="1.2" stroke-linejoin="round">{body}</g>{highlight}',
        bevel=body,
        filled=True,
    )


ICONS = {
    "pin-symbolic.svg": ("Pin widget position", pin),
    "pin-locked-symbolic.svg": ("Unpin widget position", pin_locked),
    "minimize-symbolic.svg": ("Minimize widget", minimize),
    "expand-symbolic.svg": ("Expand widget", expand),
    "close-symbolic.svg": ("Hide widget", close),
    "pause-symbolic.svg": ("Pause monitoring", pause),
    "play-symbolic.svg": ("Resume monitoring", play),
    "refresh-symbolic.svg": ("Reset session statistics", refresh),
    "settings-symbolic.svg": ("Open preferences", settings),
    "droplet-symbolic.svg": ("Uthy Speed Glass", droplet),
    "download-symbolic.svg": ("Download throughput", download),
    "upload-symbolic.svg": ("Upload throughput", upload),
    "network-symbolic.svg": ("Network monitor", network),
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, (label, builder) in sorted(ICONS.items()):
        (OUT_DIR / name).write_text(_svg(label, builder()), encoding="utf-8")
        print(f"wrote icons/{name}")


if __name__ == "__main__":
    main()
