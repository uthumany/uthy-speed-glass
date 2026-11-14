// Brushed-metal plates: the substrate the typography is pressed into.
//
// St cannot draw a brushed surface: it has no repeating backgrounds, no
// filters, no gradients on text and exactly one box-shadow per declaration.
// Every physical cue that makes text read as *punched into metal* therefore has
// to be painted: the brushed grain and the metal gradient, the dark inner
// shadow of the impression, the lit far wall along its lower edge, the lip that
// catches light outside it, and the glass sheen that sits on top of the whole
// plate.
//
// The grain is deterministic (a fixed seed), so the same plate paints
// identically on every repaint and two captures of the same widget match.
import cairo from 'gi://cairo';
import St from 'gi://St';

/**
 * Metal tones. `band` is the shallow caption strip, `brand` the deeper name
 * plate, `slab` the tray the floating controls sit on.
 */
export const METAL_TONES = {
    band: {top: [64, 70, 79], bottom: [20, 24, 30], grain: 0.085, sweep: 0.055},
    brand: {top: [52, 57, 66], bottom: [12, 15, 20], grain: 0.075, sweep: 0.045},
    slab: {top: [44, 49, 57], bottom: [16, 19, 25], grain: 0.065, sweep: 0.040},
};

function makeRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0xFFFFFFFF;
    };
}

function fillGradient(cr, x, y, width, height, from, to) {
    const gradient = new cairo.LinearGradient(x, y, x, y + Math.max(1, height));
    gradient.addColorStopRGBA(0, from[0] / 255, from[1] / 255, from[2] / 255, 1);
    gradient.addColorStopRGBA(1, to[0] / 255, to[1] / 255, to[2] / 255, 1);
    cr.setSource(gradient);
    cr.rectangle(x, y, width, height);
    cr.fill();
}

/** The metal itself: a vertical gradient, fine horizontal grain, a lit sweep. */
export function paintBrushedMetal(cr, width, height, tone = METAL_TONES.band) {
    fillGradient(cr, 0, 0, width, height, tone.top, tone.bottom);

    // Grain: short horizontal strokes of varying length, brighter and darker
    // than the base, so the surface reads as brushed rather than noisy.
    const random = makeRandom(0x5EEDBEEF);
    const strokes = Math.min(520, Math.max(24, Math.round(height * 2.6)));
    cr.setLineWidth(1);
    for (let index = 0; index < strokes; index++) {
        const y = Math.floor(random() * height) + 0.5;
        const start = random() * width * 0.55;
        const length = Math.max(6, random() * width * 0.8);
        const bright = random() > 0.48;
        const alpha = tone.grain * (0.3 + random());
        const value = bright ? 1 : 0;
        cr.setSourceRGBA(value, value, value, alpha);
        cr.newPath();
        cr.moveTo(start, y);
        cr.lineTo(Math.min(width, start + length), y);
        cr.stroke();
    }

    // A single diagonal specular sweep gives the plate one light direction.
    const sweep = new cairo.LinearGradient(0, 0, width, height);
    sweep.addColorStopRGBA(0.12, 1, 1, 1, 0);
    sweep.addColorStopRGBA(0.38, 1, 1, 1, tone.sweep);
    sweep.addColorStopRGBA(0.66, 1, 1, 1, 0);
    cr.setSource(sweep);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

/**
 * The impression itself: a dark inner shadow cast from the top and left by the
 * near walls, a sharp lit line along the far (bottom) wall, and the outer lip
 * that catches the light above it.
 */
export function paintPunchedRecess(cr, width, height, options = {}) {
    const {
        inset = 0,
        shadow = 0.80,
        lip = 0.30,
        depth = 0.62,
        top = true,
    } = options;
    const x = inset + 0.5;
    const y = inset + 0.5;
    const w = width - inset * 2 - 1;
    const h = height - inset * 2 - 1;
    if (w <= 3 || h <= 3)
        return;

    if (top) {
        const shade = new cairo.LinearGradient(x, y, x, y + h * depth);
        shade.addColorStopRGBA(0, 0, 0, 0, shadow);
        shade.addColorStopRGBA(1, 0, 0, 0, 0);
        cr.setSource(shade);
        cr.rectangle(x, y, w, h);
        cr.fill();

        const side = new cairo.LinearGradient(x, y, x + w * 0.32, y);
        side.addColorStopRGBA(0, 0, 0, 0, shadow * 0.5);
        side.addColorStopRGBA(1, 0, 0, 0, 0);
        cr.setSource(side);
        cr.rectangle(x, y, w, h);
        cr.fill();
    }

    cr.setLineWidth(1);
    // Far wall, lit from above: the sharp highlight the design asks for.
    cr.setSourceRGBA(1, 1, 1, lip);
    cr.newPath();
    cr.moveTo(x, y + h - 0.5);
    cr.lineTo(x + w, y + h - 0.5);
    cr.stroke();

    // The right inner wall catches a little of the same light.
    cr.setSourceRGBA(1, 1, 1, lip * 0.34);
    cr.newPath();
    cr.moveTo(x + w - 0.5, y);
    cr.lineTo(x + w - 0.5, y + h);
    cr.stroke();

    // The lip outside the impression: bright above, dark below.
    cr.setSourceRGBA(1, 1, 1, lip * 0.5);
    cr.newPath();
    cr.moveTo(x, y - 0.5);
    cr.lineTo(x + w, y - 0.5);
    cr.stroke();

    cr.setSourceRGBA(0, 0, 0, 0.55);
    cr.newPath();
    cr.moveTo(x, y + h + 0.5);
    cr.lineTo(x + w, y + h + 0.5);
    cr.stroke();
}

/** A clear glass overlay: a faint sheen falling from the top, and a lit edge. */
export function paintGlassOverlay(cr, width, height, options = {}) {
    const {alpha = 0.075} = options;
    const sheen = new cairo.LinearGradient(0, 0, 0, Math.max(1, height * 0.62));
    sheen.addColorStopRGBA(0, 1, 1, 1, alpha);
    sheen.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(sheen);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, alpha * 2.1);
    cr.newPath();
    cr.moveTo(0, 0.5);
    cr.lineTo(width, 0.5);
    cr.stroke();
}

/**
 * A plate actor. It fills whatever box it is given, repaints only when its size
 * changes, and is never reactive: it is a surface, not a control.
 */
export function createMetalPlate({styleClass = 'uthy-metal-plate', tone = 'band', recess = true,
    glass = true, recessOptions = {}} = {}) {
    const area = new St.DrawingArea({
        style_class: styleClass,
        x_expand: true,
        y_expand: true,
        can_focus: false,
        reactive: false,
    });
    const palette = METAL_TONES[tone] ?? METAL_TONES.band;

    area.connect('repaint', widget => {
        const cr = widget.get_context();
        if (!cr)
            return;
        const width = widget.get_width();
        const height = widget.get_height();
        if (width <= 3 || height <= 3) {
            cr.$dispose?.();
            return;
        }
        try {
            cr.setOperator(0); // CLEAR
            cr.paint();
            cr.setOperator(2); // OVER
            paintBrushedMetal(cr, width, height, palette);
            if (recess)
                paintPunchedRecess(cr, width, height, recessOptions);
            if (glass)
                paintGlassOverlay(cr, width, height);
        } finally {
            cr.$dispose?.();
        }
    });

    const queue = () => area.queue_repaint();
    area.connect('notify::width', queue);
    area.connect('notify::height', queue);
    return area;
}
