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
ring, so focusing the card never changes its layout. On the controls the ring
is a 2 px border that is reserved transparent in the resting state and only
coloured on focus, so focusing never resizes a control either. A border is used
rather than a shadow because St paints an outer `box-shadow` as a filled block
behind an actor that has no background, and does not paint an inset one at all:
with the icon buttons deliberately transparent, a shadow ring either covered
the icon or disappeared. Re-measured after the icon change, counting ring
coloured pixels inside the card: 509 at rest (the metric icons themselves), 750
with the first control focused, then 729 and 719 as focus moved on.

### The square orange design

The focus ring is now the accent colour, `#FF8A1F`, on every stop: a two-pixel
ring around the slab when the card holds focus, a reserved border coloured on
the title-strip controls, and an orange rim on a focused tray plate. Re-measured
in the redesigned session, counting ring-coloured pixels: 0 at rest, a ring
around the card after a press, a ring on the first title-strip control after
Tab, a ring on a tray plate four Tabs later, and 0 again after Escape. The ring
still costs no layout on any stop.

The tray plates are the one control that is *not* transparent, so their ring is
a rim colour change rather than a reserved border; the resting rim is silver and
the focused rim is the accent, which keeps the ring visible against both the
plate and the tray.

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

### The machined panels

| Element | Ratio |
| --- | --- |
| Reading in its slot | 16.7:1 |
| Caption in its slot band | 11.9:1 |
| Peak line in its slot | 10.0:1 |
| Statistic caption band | 8.8:1 |
| Statistic value | 15.7:1 |
| Aluminium frame against the cavity | 6.9:1 |
| Meter bar against its channel | 15.4:1 |

The upload meter is steel blue by default rather than silver, because the bar
carries meaning and a grey bar on a grey channel was hard to read; both meter
colours are user settings and both are checked against the channel, not against
the panel.

### The instrument panel

| Element | Ratio |
| --- | --- |
| Traffic tube against the window floor | 7.4:1 |
| Statistic value in its slot | 11.1:1 |
| Button label on its cap | 6.0:1 |
| Cap against the tray it is mounted on | 4.8:1 |
| LED dome against its socket | 17.7:1 |
| Name on the header impression | 7.8:1 |

The cap clears the tray it sits on by 4.8:1, and it is also bounded by a lit top
edge and a cast shadow, so a button is never found by its fill alone. The
pressed state replaces the cap with a socket rather than only darkening it, so
the state survives a monochrome reading of the screen as well as a colour one.

The header impression is a soft gradient with no outline, which is why its lit
bottom wall is the only edge it gets: the name itself is still an engraved pair
of labels, measured above.

### The engraved type scale

Measured on the rendered pixels of the engraved type (ink sampled at its
brightest, the substrate just below it):

| Element | Ratio |
| --- | --- |
| Caption ink on its punched band (`DOWNLOAD`) | 9.8:1 |
| Reading ink on the recessed well (`826 KB/s`) | 14.8:1 |
| `Peak` label on the well | 9.1:1 |
| Statistic caption on its band (`SESSION RX`) | 10.6:1 |
| Statistic value on the slab (`6.0 MB`) | 15.7:1 |
| Status text on the slab (`eth0`) | 10.8:1 |
| Brand ink on the name plate (`UthyPing`) | 8.8:1 |
| Control ink on its plate (`Auto`) | 14.8:1 |

The engraved pairs are stacked labels, so the shadow copy is marked with a
decorative accessible role (`Clutter.AccessibleRole.NONE`) wherever the toolkit
provides one: the pair is one piece of text, not two. Screen-reader output has
still not been checked with a real reader, and on a Shell build without that
role the copy would be exposed as a second label, which is the one known
accessibility cost of the effect.

### The square orange palette

Re-measured after the redesign, sampling the rendered pixels of the expanded
card (accent `#FF8A1F`, wells, engraved labels and the emerald LED):

| Element | Ratio |
| --- | --- |
| Metric value (`#F2F5F8`) on the recessed well | 13.2:1 |
| Engraved `Peak` label (`#9DABB9`) on the well | 6.7:1 |
| Status text (`#CBD5E0`) on the slab | 9.9:1 |
| Statistic value (`#F2F5F8`) on the slab | 16.2:1 |
| Orange meter fill against its groove | 10.4:1 |
| Engraved name plate lettering on the recessed floor | 11.5:1 |

All are above the 4.5:1 small-text threshold, and the meter and the LED are
above the 3:1 non-text threshold. The engraved labels are deliberately the
lowest of the set: they are secondary text at 9–10 px, and they still clear the
threshold with room to spare.

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

The redesigned controls add one more animation to that set: a raised tray plate
travels two pixels towards the pointer on hover and one pixel down when pressed.
Measured on rendered pixels by tracking the centre of the green refresh icon in
both modes:

| Preference | Icon centre, rest → hover | Shift |
| --- | --- | --- |
| Reduce motion off | 29.52 px → 27.81 px | −1.71 px, and the icon grows |
| Reduce motion on | 29.52 px → 29.52 px | 0.00 px, identical pixels |

So the reduced-motion mode suppresses the travel and the scale entirely while
the hover wash and every other cue stay visible.

## What is not covered

- Screen-reader output. Actors carry `accessible_name` values, but the labels
  they expose have not been checked with a screen reader.
- The preferences window's own keyboard and contrast behaviour.
- Physical Zorin OS 18.1 hardware, multi-monitor layouts and X11 sessions.
