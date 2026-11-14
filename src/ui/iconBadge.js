// A glossy badge for the metric icons.
//
// The supplied icon set is flat artwork, and on a machined panel a flat mark
// looks printed on rather than mounted. Each metric icon therefore sits on a
// small domed badge: a dark steel body lit from above, a lit top and left rim
// over a dark bottom and right one, a glossy highlight across the upper half,
// a reflection along the lower edge, a contact shadow underneath, and a faint
// tint of the metric's own colour so the two badges stay distinguishable.
//
// Corners are square, like everything else in the interface: the gloss is a
// dome of light on a square plate, not a round medallion.
import cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {hexToRgb, lighten} from './glassMaterial.js';
import {createPaintedArea} from './metalPlate.js';

function stroke(cr, x0, y0, x1, y1) {
    cr.newPath();
    cr.moveTo(x0, y0);
    cr.lineTo(x1, y1);
    cr.stroke();
}

export function paintBadge(cr, width, height, {tint = null} = {}) {
    if (width <= 6 || height <= 6)
        return;

    const edge = Math.min(width, height);
    const radius = edge / 2;
    const accent = tint ? hexToRgb(tint) : null;

    // Contact shadow: the badge sits on the panel rather than in it.
    const shadow = new cairo.LinearGradient(0, height * 0.55, 0, height);
    shadow.addColorStopRGBA(0, 0, 0, 0, 0);
    shadow.addColorStopRGBA(1, 0, 0, 0, 0.55);
    cr.setSource(shadow);
    cr.rectangle(0, height * 0.55, width, height * 0.45);
    cr.fill();

    // Body: dark steel, lit from above, warmed by the metric colour at the base.
    const body = new cairo.LinearGradient(0, 0, 0, height);
    body.addColorStopRGBA(0, 0.48, 0.52, 0.58, 1);
    body.addColorStopRGBA(0.34, 0.27, 0.30, 0.35, 1);
    body.addColorStopRGBA(0.72, 0.13, 0.15, 0.19, 1);
    body.addColorStopRGBA(1, 0.07, 0.09, 0.12, 1);
    cr.setSource(body);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    if (accent) {
        const tintGradient = new cairo.LinearGradient(0, height * 0.45, 0, height);
        tintGradient.addColorStopRGBA(0, accent.red / 255, accent.green / 255, accent.blue / 255, 0);
        tintGradient.addColorStopRGBA(1, accent.red / 255, accent.green / 255, accent.blue / 255, 0.30);
        cr.setSource(tintGradient);
        cr.rectangle(0, height * 0.45, width, height * 0.55);
        cr.fill();
    }

    // The domed gloss across the upper half.
    const gloss = new cairo.RadialGradient(width * 0.5, height * 0.28, radius * 0.12,
        width * 0.5, height * 0.3, radius * 1.05);
    gloss.addColorStopRGBA(0, 1, 1, 1, 0.52);
    gloss.addColorStopRGBA(0.55, 1, 1, 1, 0.14);
    gloss.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(gloss);
    cr.rectangle(0, 0, width, height * 0.62);
    cr.fill();

    // The reflection along the lower edge, so the body reads as curved.
    const reflection = new cairo.LinearGradient(0, height * 0.72, 0, height);
    reflection.addColorStopRGBA(0, 1, 1, 1, 0);
    reflection.addColorStopRGBA(0.7, 1, 1, 1, 0.10);
    reflection.addColorStopRGBA(1, 1, 1, 1, 0.22);
    cr.setSource(reflection);
    cr.rectangle(0, height * 0.72, width, height * 0.28);
    cr.fill();

    // The rim: lit on the top and left, dark on the bottom and right.
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, 0.50);
    stroke(cr, 0.5, 0.5, width - 0.5, 0.5);
    stroke(cr, 0.5, 0.5, 0.5, height - 0.5);
    cr.setSourceRGBA(0, 0, 0, 0.72);
    stroke(cr, 0.5, height - 0.5, width - 0.5, height - 0.5);
    stroke(cr, width - 0.5, 0.5, width - 0.5, height - 0.5);

    // A second, dimmer inner rim keeps the bevel from looking like a hairline.
    cr.setSourceRGBA(1, 1, 1, 0.14);
    stroke(cr, 1.5, 1.5, width - 1.5, 1.5);
    cr.setSourceRGBA(0, 0, 0, 0.35);
    stroke(cr, 1.5, height - 1.5, width - 1.5, height - 1.5);

    if (accent) {
        // A whisper of the metric colour on the top edge, so the two badges
        // read as different materials without shouting.
        const lit = lighten(accent, 0.6);
        cr.setSourceRGBA(lit.red / 255, lit.green / 255, lit.blue / 255, 0.28);
        stroke(cr, 2.5, 2.5, width - 2.5, 2.5);
    }
}

/** The badge with its icon mounted on it. */
export function createIconBadge({icon, size = 26, tint = null}) {
    const holder = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: 'uthy-icon-badge',
        width: size,
        height: size,
        reactive: false,
        can_focus: false,
    });
    const plate = createPaintedArea({
        styleClass: 'uthy-badge-plate',
        paint: (cr, width, height) => paintBadge(cr, width, height, {tint}),
    });
    holder.add_child(plate);
    holder.add_child(icon);
    return holder;
}
