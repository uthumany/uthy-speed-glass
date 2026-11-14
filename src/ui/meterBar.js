// The speed meter: a machined channel with a glossy metal bar inside it.
//
// Both halves are painted rather than styled, because St can put only one
// two-stop gradient on an actor and neither half is that simple. The channel
// needs a dark floor, an inner shadow at its top edge (the light comes from
// above), an inner gradient, a thin beveled metallic rim and etched tick marks;
// the bar needs a brushed-metal body, a specular strip along its top third, a
// dark base line and a bright leading edge that glows so the meter reads as
// live while it moves.
//
// The bar is a real actor whose width is animated by the motion helper, so it
// repaints as it travels and its leading edge always catches the light.
import cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {darken, hexToRgb, lighten} from './glassMaterial.js';
import {createPaintedArea} from './metalPlate.js';

/** The channel is this tall, and the bar sits this far inside it. */
export const METER_HEIGHT = 11;
const BAR_INSET = 2;
/** Etched ticks every this many pixels, like a physical gauge. */
const TICK_PITCH = 24;

function stroke(cr, x0, y0, x1, y1) {
    cr.newPath();
    cr.moveTo(x0, y0);
    cr.lineTo(x1, y1);
    cr.stroke();
}

/** The recessed channel: deep, dark at the top, with a beveled metal rim. */
export function paintChannel(cr, width, height) {
    if (width <= 4 || height <= 4)
        return;

    const floor = new cairo.LinearGradient(0, 0, 0, height);
    floor.addColorStopRGBA(0, 0, 0, 0, 0.95);
    floor.addColorStopRGBA(0.42, 0.03, 0.04, 0.06, 0.88);
    floor.addColorStopRGBA(1, 0.07, 0.09, 0.13, 0.82);
    cr.setSource(floor);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    // Light enters from above, so the top edge of the channel is shadowed.
    const shade = new cairo.LinearGradient(0, 0, 0, Math.min(height, 6));
    shade.addColorStopRGBA(0, 0, 0, 0, 1);
    shade.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(shade);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    // Etched ticks, each one a dark line with a lit edge below it.
    cr.setLineWidth(1);
    for (let x = TICK_PITCH; x < width - 3; x += TICK_PITCH) {
        cr.setSourceRGBA(0, 0, 0, 0.45);
        stroke(cr, x + 0.5, 2, x + 0.5, height - 2);
        cr.setSourceRGBA(1, 1, 1, 0.06);
        stroke(cr, x + 1.5, 2, x + 1.5, height - 2);
    }

    // The rim: dark above the opening, lit along the far wall, with the outer
    // edges the other way round.
    cr.setSourceRGBA(0, 0, 0, 0.72);
    stroke(cr, 0, 0.5, width, 0.5);
    cr.setSourceRGBA(1, 1, 1, 0.16);
    stroke(cr, 0, height - 0.5, width, height - 0.5);
    cr.setSourceRGBA(0, 0, 0, 0.55);
    stroke(cr, 0.5, 0, 0.5, height);
    stroke(cr, width - 0.5, 0, width - 0.5, height);
}

/** The bar: brushed metal, a specular strip, and a lit leading edge. */
export function paintBar(cr, width, height, {accent}) {
    if (width <= 1 || height <= 3)
        return;

    const color = hexToRgb(accent);
    const lit = lighten(color, 0.58);
    const deep = darken(color, 0.45);

    // The body, lit from above.
    const body = new cairo.LinearGradient(0, 0, 0, height);
    body.addColorStopRGBA(0, lit.red / 255, lit.green / 255, lit.blue / 255, 0.99);
    body.addColorStopRGBA(0.36, color.red / 255, color.green / 255, color.blue / 255, 1);
    body.addColorStopRGBA(1, deep.red / 255, deep.green / 255, deep.blue / 255, 0.99);
    cr.setSource(body);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    // Brushed grain along the length of the bar.
    let seed = 0x1F0C0FFEE;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xFFFFFFFF;
    };
    cr.setLineWidth(1);
    for (let index = 0; index < Math.round(height * 1.6); index++) {
        const y = Math.floor(random() * height) + 0.5;
        const start = random() * width * 0.5;
        const length = Math.max(4, random() * width * 0.7);
        const bright = random() > 0.5;
        const value = bright ? 1 : 0;
        cr.setSourceRGBA(value, value, value, 0.07 * (0.4 + random()));
        stroke(cr, start, y, Math.min(width, start + length), y);
    }

    // The glass-like sheen along the top third.
    const gloss = new cairo.LinearGradient(0, 0, 0, Math.max(2, height * 0.46));
    gloss.addColorStopRGBA(0, 1, 1, 1, 0.55);
    gloss.addColorStopRGBA(0.55, 1, 1, 1, 0.16);
    gloss.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(gloss);
    cr.rectangle(0, 0, width, Math.max(2, height * 0.46));
    cr.fill();

    // The base line, so the bar sits inside the channel instead of floating.
    cr.setSourceRGBA(0, 0, 0, 0.5);
    stroke(cr, 0, height - 0.5, width, height - 0.5);

    // The leading edge: bright, with a glow trailing behind it.
    const glow = new cairo.LinearGradient(Math.max(0, width - 7), 0, width, 0);
    glow.addColorStopRGBA(0, 1, 1, 1, 0);
    glow.addColorStopRGBA(1, 1, 1, 1, 0.34);
    cr.setSource(glow);
    cr.rectangle(Math.max(0, width - 7), 0, Math.min(7, width), height);
    cr.fill();

    cr.setSourceRGBA(1, 1, 1, 0.9);
    stroke(cr, width - 0.5, 0, width - 0.5, height);
    cr.setSourceRGBA(1, 1, 1, 0.35);
    stroke(cr, width - 1.5, 0, width - 1.5, height);
}

/**
 * The meter. Returns the track actor, the bar actor whose width carries the
 * reading, and the height the bar occupies inside the channel.
 */
export function createMeterBar({accent, styleClass = 'uthy-meter'}) {
    const track = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: styleClass,
        x_expand: true,
        height: METER_HEIGHT,
        reactive: false,
    });
    const channel = createPaintedArea({
        styleClass: 'uthy-meter-channel',
        paint: (cr, width, height) => paintChannel(cr, width, height),
    });
    const barHeight = Math.max(3, METER_HEIGHT - BAR_INSET * 2);
    const fill = createPaintedArea({
        styleClass: 'uthy-meter-fill',
        paint: (cr, width, height) => paintBar(cr, width, height, {accent}),
        xExpand: false,
        yExpand: false,
    });
    fill.x_align = Clutter.ActorAlign.START;
    fill.y_align = Clutter.ActorAlign.CENTER;
    fill.width = 0;
    fill.height = barHeight;

    // A BinLayout centres a child that does not expand, and the bar must start
    // at the left edge of its channel, so it is packed into a row with a
    // spacer that takes the rest of the width.
    const row = new St.BoxLayout({
        style_class: 'uthy-meter-row',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    row.add_child(fill);
    row.add_child(new St.Widget({x_expand: true}));

    track.add_child(channel);
    track.add_child(row);
    return {actor: track, channel, fill, row, barHeight};
}
