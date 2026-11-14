// The slab's inner layers, painted behind the widget's content.
//
// The design calls for a translucent slab with a top specular rim, a bottom
// edge, a faint grid and a noise overlay. St cannot do any of that in CSS: it
// has no backdrop sampling, no repeating backgrounds and exactly one
// box-shadow per declaration, and the card already spends its shadow on the
// cast shadow that floats it above the desktop. So the inner layers are
// painted here, on a single DrawingArea that covers the whole card.
//
// The area repaints only when its size changes - not on every reading - so the
// noise costs nothing while the widget is idle. Both the grid and the noise
// are deterministic, so two captures of the same size are identical.

import cairo from 'gi://cairo';
import St from 'gi://St';

import {GRID_ALPHA, GRID_PITCH, NOISE_ALPHA} from './glassMaterial.js';

/** One dot per this many square pixels; low enough to read as grain. */
const NOISE_DENSITY = 88;

function paintGrid(cr, width, height) {
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, GRID_ALPHA);
    for (let x = GRID_PITCH; x < width; x += GRID_PITCH) {
        cr.newPath();
        cr.moveTo(x + 0.5, 0);
        cr.lineTo(x + 0.5, height);
        cr.stroke();
    }
    for (let y = GRID_PITCH; y < height; y += GRID_PITCH) {
        cr.newPath();
        cr.moveTo(0, y + 0.5);
        cr.lineTo(width, y + 0.5);
        cr.stroke();
    }
}

function paintNoise(cr, width, height) {
    const count = Math.min(6000, Math.round((width * height) / NOISE_DENSITY));
    // A fixed seed keeps the grain stable across repaints, so the surface
    // never shimmers when the widget is resized by a pixel.
    let seed = 0x9E3779B9;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xFFFFFFFF;
    };
    for (let index = 0; index < count; index++) {
        const x = Math.floor(random() * width);
        const y = Math.floor(random() * height);
        const bright = random() > 0.42;
        cr.setSourceRGBA(bright ? 1 : 0, bright ? 1 : 0, bright ? 1 : 0, NOISE_ALPHA);
        cr.rectangle(x, y, 1, 1);
        cr.fill();
    }
}

function paintSheen(cr, width, height) {
    const gradient = new cairo.LinearGradient(0, 0, 0, Math.max(1, height * 0.5));
    gradient.addColorStopRGBA(0, 1, 1, 1, 0.075);
    gradient.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(gradient);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

/** The specular rim: bright along the top edge, dark along the bottom. */
function paintRim(cr, width, height) {
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, 0.20);
    cr.newPath();
    cr.moveTo(0, 0.5);
    cr.lineTo(width, 0.5);
    cr.stroke();

    cr.setSourceRGBA(0, 0, 0, 0.45);
    cr.newPath();
    cr.moveTo(0, height - 0.5);
    cr.lineTo(width, height - 0.5);
    cr.stroke();

    cr.setSourceRGBA(1, 1, 1, 0.06);
    cr.newPath();
    cr.moveTo(0.5, 0);
    cr.lineTo(0.5, height);
    cr.moveTo(width - 0.5, 0);
    cr.lineTo(width - 0.5, height);
    cr.stroke();
}

/**
 * A full-size backdrop. It must be the first child of the card so every other
 * layer is painted above it, and the card must carry no padding of its own,
 * otherwise the rim would be drawn inside the padding box instead of on the
 * border.
 */
export function createGlassBackdrop() {
    const area = new St.DrawingArea({
        style_class: 'uthy-backdrop',
        x_expand: true,
        y_expand: true,
        can_focus: false,
        reactive: false,
    });

    area.connect('repaint', widget => {
        const cr = widget.get_context();
        if (!cr)
            return;
        const width = widget.get_width();
        const height = widget.get_height();
        if (width <= 2 || height <= 2) {
            cr.$dispose?.();
            return;
        }
        try {
            cr.setOperator(0); // CLEAR
            cr.paint();
            cr.setOperator(2); // OVER
            paintSheen(cr, width, height);
            paintGrid(cr, width, height);
            paintNoise(cr, width, height);
            paintRim(cr, width, height);
        } finally {
            cr.$dispose?.();
        }
    });

    const queue = () => area.queue_repaint();
    area.connect('notify::width', queue);
    area.connect('notify::height', queue);
    return area;
}
