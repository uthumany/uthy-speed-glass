# Accessibility verification

This document records how the widget's accessibility was verified and what the
measurements were. Everything below was measured on a rendered GNOME Shell 46
session (`gnome-shell --nested --wayland`), not derived from the source alone.

## Keyboard and focus

St does not give key focus to a chrome actor: Tab on the desktop does not reach
a widget added with `Main.layoutManager.addChrome()`, and pressing the widget
does not grab focus either. The focus ring the widget draws was therefore
unreachable, and Tab never descended into the toolbar.

The widget now takes key focus when it is pressed, cycles its own buttons on
Tab, Shift+Tab, the arrow keys and (via St) Enter or Space, and releases focus
on Escape. Focus traversal is handled in `_cycleFocus()`, because St does not
walk into the children of a chrome actor.

Verified by counting focus-ring pixels on the card outline and inside the card
across a scripted session:

| State | Card outline ring | Control ring |
| --- | --- | --- |
| At rest | 0 | 0 |
| After pressing the card | 1102 | 0 |
| Tab 1 | 0 | 599 |
| Tab 2 | 0 | 626 |
| Tab 3 | 0 | 611 |
| Shift+Tab | 0 | 611 |
| Arrow Down | 0 | 611 |
| Escape | 0 | 0 |

The card ring is drawn by swapping the card's single shadow for a two-pixel
ring, so focusing the card never changes its layout. Each control keeps the
theme's `:focus` ring, which is a cyan border plus a two-pixel glow.

## Contrast

Contrast was measured on rendered pixels: the surface behind each text element
is taken as the most common colour inside a tight box around its glyphs, the
text colour is composited over it at its own alpha, and the WCAG 2.1 ratio is
computed from the relative luminances. Large text (the 22 px reading) is judged
at 3:1, everything else at 4.5:1.

| Text | Dark desktop | Bright backdrop, transparency 78 | Bright backdrop, transparency 45 |
| --- | --- | --- | --- |
| Brand label, 9 px at 72 % | 7.02:1 | 7.02:1 | 7.99:1 |
| Panel title, 9 px | 7.28:1 | 7.28:1 | 7.93:1 |
| Gauge reading, 22 px bold | 14.12:1 | 13.98:1 | 16.18:1 |
| Gauge caption, 10 px | 10.19:1 | 10.19:1 | 10.67:1 |
| Stat label, 9 px | 9.89:1 | 9.89:1 | 10.19:1 |
| Stat value, 11 px bold | 16.76:1 | 16.76:1 | 16.81:1 |
| Status footer, 10 px | 10.48:1 | 10.48:1 | 10.43:1 |
| Control label, 10 px | 18.07:1 | 12.94:1 | 18.00:1 |

The bright backdrop was a solid `#f0f0f0` desktop, the hardest case the widget
can meet, tested at both the default transparency (78) and the minimum the
settings allow (45).

The brand label was the one failure: the title strip's sheen and a bright
wallpaper together lifted the strip above the card's own tint and the label
measured 4.16:1 at the minimum transparency. The strip now carries a dark base
under the sheen, which holds it at 7.99:1 in the same conditions. No other text
element failed in any tested condition.

### A layering constraint worth keeping

The card paints its tint twice: once as `background-color` and again as the
vertical gradient that keeps the slab top-lit. St paints both, so the effective
opacity is higher than the transparency setting alone suggests — the slider at
45 renders like a single layer of about 0.78. That is also what keeps text
legible at low transparency over a bright wallpaper, so the gradient must not
be flattened into a single layer without re-measuring contrast.

## Reduced motion

The Reduce motion preference is read from settings and applied through the
`Motion` helper, which every animation in the widget goes through; the only
animation call outside that helper is the button release in the icon factory.

Verified by tracing each animation decision in a live session and toggling the
preference while the widget was running:

| Preference | Animation decisions recorded |
| --- | --- |
| Reduce motion off | 46 meter width animations, 9 scale animations, 2 reading pulses, 1 idle breathing loop |
| Reduce motion on | 0 animations: 48 meter widths applied instantly, 2 pulses skipped, 5 scale resets without animation |
| Turned back off | animations and idle breathing resume |

Turning the preference on while the widget runs also stops the idle breathing
immediately, and turning it off restarts it.

## What is not covered

- Screen-reader output. Actors carry `accessible_name` values, but the labels
  they expose have not been checked with a screen reader.
- The preferences window's own keyboard and contrast behaviour.
- Physical Zorin OS 18.1 hardware, multi-monitor layouts and X11 sessions.
