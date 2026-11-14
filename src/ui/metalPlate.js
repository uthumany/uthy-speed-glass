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

/** Brushed aluminium: the frame a machined slot is cut into. */
export const ALUMINIUM = {top: [108, 115, 126], bottom: [44, 49, 58], grain: 0.105, sweep: 0.075};

function stroke(cr, x0, y0, x1, y1) {
    cr.newPath();
    cr.moveTo(x0, y0);
    cr.lineTo(x1, y1);
    cr.stroke();
}

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
 * A painted surface. Every plate in the project goes through this factory so
 * the lifecycle is identical: clear, run the painter, dispose the context, and
 * repaint only when the size changes. Nothing here is ever reactive - a plate
 * is a surface, not a control.
 */
export function createPaintedArea({styleClass, paint, xExpand = true, yExpand = true}) {
    const area = new St.DrawingArea({
        style_class: styleClass,
        x_expand: xExpand,
        y_expand: yExpand,
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
            paint(cr, width, height);
        } finally {
            cr.$dispose?.();
        }
    });

    const queue = () => area.queue_repaint();
    area.connect('notify::width', queue);
    area.connect('notify::height', queue);
    return area;
}

/** A brushed-metal plate with an optional punched impression and glass sheen. */
export function createMetalPlate({styleClass = 'uthy-metal-plate', tone = 'band', recess = true,
    glass = true, recessOptions = {}} = {}) {
    const palette = METAL_TONES[tone] ?? METAL_TONES.band;
    return createPaintedArea({
        styleClass,
        paint: (cr, width, height) => {
            paintBrushedMetal(cr, width, height, palette);
            if (recess)
                paintPunchedRecess(cr, width, height, recessOptions);
            if (glass)
                paintGlassOverlay(cr, width, height);
        },
    });
}

/**
 * A slot machined into brushed aluminium: a thin metallic frame with a
 * specular glint along its top edge, and a cavity cut into it whose two-pixel
 * bevel catches the light on the top and left inner edges while the bottom and
 * right edges fall into shadow, under an inner gradient that reaches five
 * pixels down from the opening.
 */
export function paintMachinedSlot(cr, width, height, options = {}) {
    const {
        inset = 3,
        bevel = 2,
        depth = 5,
        glint = 0.6,
        frame = ALUMINIUM,
        cavityTop = [4, 6, 10],
        cavityBottom = [17, 21, 29],
    } = options;
    if (width <= 8 || height <= 8)
        return;

    paintBrushedMetal(cr, width, height, frame);

    // The frame's own edges: a glint along the top, a shadow under the bottom.
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, glint);
    stroke(cr, 0.5, 0.5, width - 0.5, 0.5);
    cr.setSourceRGBA(0, 0, 0, 0.6);
    stroke(cr, 0.5, height - 0.5, width - 0.5, height - 0.5);

    const x = inset;
    const y = inset;
    const w = width - inset * 2;
    const h = height - inset * 2;
    if (w <= 6 || h <= 6)
        return;

    // The cavity floor: dark at the opening, easing towards the light at the
    // bottom of the cut.
    fillGradient(cr, x, y, w, h, cavityTop, cavityBottom);

    // The inner gradient that makes the slot read as deep.
    const shade = new cairo.LinearGradient(x, y, x, y + Math.min(h, depth + 2));
    shade.addColorStopRGBA(0, 0, 0, 0, 0.9);
    shade.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(shade);
    cr.rectangle(x, y, w, h);
    cr.fill();

    const side = new cairo.LinearGradient(x, y, x + Math.min(w, depth + 4), y);
    side.addColorStopRGBA(0, 0, 0, 0, 0.5);
    side.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(side);
    cr.rectangle(x, y, w, h);
    cr.fill();

    // The machined bevel: lit on the top and left, shadowed on the bottom and
    // right, two pixels wide and fading inwards.
    for (let step = 0; step < bevel; step++) {
        const fade = 1 - step / (bevel + 0.5);
        cr.setSourceRGBA(1, 1, 1, 0.44 * fade);
        stroke(cr, x + step + 0.5, y + step + 0.5, x + w - step - 0.5, y + step + 0.5);
        stroke(cr, x + step + 0.5, y + step + 0.5, x + step + 0.5, y + h - step - 0.5);
        cr.setSourceRGBA(0, 0, 0, 0.55 * fade);
        stroke(cr, x + step + 0.5, y + h - step - 0.5, x + w - step - 0.5, y + h - step - 0.5);
        stroke(cr, x + w - step - 0.5, y + step + 0.5, x + w - step - 0.5, y + h - step - 0.5);
    }
}

export function createSlotPlate({styleClass = 'uthy-slot-plate', options = {}} = {}) {
    return createPaintedArea({
        styleClass,
        paint: (cr, width, height) => paintMachinedSlot(cr, width, height, options),
    });
}

/**
 * The same machined slot, glazed: a recessed window cut into the frame with a
 * reflection across its top half and a faint diagonal sheen, so what is drawn
 * behind it reads as being under glass.
 */
export function paintGlassWindow(cr, width, height, options = {}) {
    const {
        inset = 3,
        bevel = 2,
        depth = 5,
        glint = 0.5,
        frame = ALUMINIUM,
        cavityTop = [5, 8, 13],
        cavityBottom = [13, 17, 24],
    } = options;
    paintMachinedSlot(cr, width, height, {inset, bevel, depth, glint, frame, cavityTop, cavityBottom});

    const x = inset;
    const y = inset;
    const w = width - inset * 2;
    const h = height - inset * 2;
    if (w <= 6 || h <= 6)
        return;

    paintGlassReflection(cr, x, y, w, h);
}

/** The reflection of a glazed surface: a lit top half and a diagonal sheen. */
export function paintGlassReflection(cr, x, y, width, height) {
    const reflection = new cairo.LinearGradient(x, y, x, y + height * 0.58);
    reflection.addColorStopRGBA(0, 1, 1, 1, 0.11);
    reflection.addColorStopRGBA(0.55, 1, 1, 1, 0.035);
    reflection.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(reflection);
    cr.rectangle(x, y, width, height);
    cr.fill();

    const sheen = new cairo.LinearGradient(x, y + height, x + width * 0.7, y);
    sheen.addColorStopRGBA(0, 1, 1, 1, 0);
    sheen.addColorStopRGBA(0.5, 1, 1, 1, 0.04);
    sheen.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(sheen);
    cr.rectangle(x, y, width, height);
    cr.fill();
}

/**
 * A glazed overlay: the reflection alone, as a layer above whatever is drawn
 * behind it, so the traffic line sits under glass instead of on top of it.
 */
export function createGlassOverlay({styleClass = 'uthy-glass-overlay', inset = 3} = {}) {
    return createPaintedArea({
        styleClass,
        paint: (cr, width, height) => {
            const w = width - inset * 2;
            const h = height - inset * 2;
            if (w <= 6 || h <= 6)
                return;
            paintGlassReflection(cr, inset, inset, w, h);
        },
    });
}

/** Brushed steel for a control cap: lighter than the panel it sits on. */
export const CAP_STEEL = {top: [154, 162, 174], bottom: [64, 71, 82], grain: 0.085, sweep: 0.055};

/**
 * A physical push button.
 *
 * Raised, it is a square metallic cap with a brushed texture, a beveled edge
 * lit on the top and left, a glossy reflection across its top half, and a cast
 * shadow underneath so it sits proud of the panel. Pressed, the cap is gone and
 * the button is a socket: the inner shadows flip, the floor darkens away from
 * the light, the far wall catches it, and the gloss dims. Both states keep the
 * same one-pixel outline, so a press never moves the surrounding layout.
 */
export function paintPushButtonCap(cr, width, height, {pressed = false, hover = false, cap = CAP_STEEL} = {}) {
    const margin = 1;
    const shadowRoom = 3;
    const x = margin;
    const y = margin;
    const w = width - margin * 2;
    const h = height - margin * 2 - shadowRoom;
    if (w <= 6 || h <= 6)
        return;

    if (pressed) {
        const floor = new cairo.LinearGradient(0, y, 0, y + h);
        floor.addColorStopRGBA(0, 0, 0, 0, 0.72);
        floor.addColorStopRGBA(1, 0.09, 0.11, 0.14, 0.5);
        cr.setSource(floor);
        cr.rectangle(x, y, w, h);
        cr.fill();

        // The inner shadow now falls from the top and left, because the cap has
        // sunk below the surface the light reaches.
        const shade = new cairo.LinearGradient(x, y, x, y + Math.min(h, 6));
        shade.addColorStopRGBA(0, 0, 0, 0, 0.8);
        shade.addColorStopRGBA(1, 0, 0, 0, 0);
        cr.setSource(shade);
        cr.rectangle(x, y, w, h);
        cr.fill();

        const side = new cairo.LinearGradient(x, y, x + Math.min(w, 5), y);
        side.addColorStopRGBA(0, 0, 0, 0, 0.6);
        side.addColorStopRGBA(1, 0, 0, 0, 0);
        cr.setSource(side);
        cr.rectangle(x, y, w, h);
        cr.fill();

        cr.setLineWidth(1);
        cr.setSourceRGBA(0, 0, 0, 0.7);
        stroke(cr, x, y + 0.5, x + w, y + 0.5);
        stroke(cr, x + 0.5, y, x + 0.5, y + h);
        cr.setSourceRGBA(1, 1, 1, 0.16);
        stroke(cr, x, y + h - 0.5, x + w, y + h - 0.5);
        stroke(cr, x + w - 0.5, y, x + w - 0.5, y + h);

        // The gloss is still there, just dimmed.
        const gloss = new cairo.LinearGradient(0, y, 0, y + h * 0.5);
        gloss.addColorStopRGBA(0, 1, 1, 1, 0.05);
        gloss.addColorStopRGBA(1, 1, 1, 1, 0);
        cr.setSource(gloss);
        cr.rectangle(x, y, w, h * 0.5);
        cr.fill();
        return;
    }

    // The cast shadow, in three layers, so the cap sits proud of the panel.
    for (let step = 0; step < shadowRoom; step++) {
        cr.setSourceRGBA(0, 0, 0, 0.34 * (1 - step / shadowRoom));
        cr.rectangle(x + step, y + h + step, w - step * 2, 1);
        cr.fill();
    }

    cr.save();
    cr.translate(x, y);
    paintBrushedMetal(cr, w, h, cap);
    cr.restore();

    cr.setLineWidth(1);
    cr.setSourceRGBA(0, 0, 0, 0.68);
    cr.rectangle(x + 0.5, y + 0.5, w - 1, h - 1);
    cr.stroke();

    cr.setSourceRGBA(1, 1, 1, hover ? 0.55 : 0.42);
    stroke(cr, x + 1.5, y + 1.5, x + w - 1.5, y + 1.5);
    stroke(cr, x + 1.5, y + 1.5, x + 1.5, y + h - 1.5);
    cr.setSourceRGBA(0, 0, 0, hover ? 0.6 : 0.5);
    stroke(cr, x + 1.5, y + h - 1.5, x + w - 1.5, y + h - 1.5);
    stroke(cr, x + w - 1.5, y + 1.5, x + w - 1.5, y + h - 1.5);

    const gloss = new cairo.LinearGradient(0, y + 1, 0, y + h * 0.52);
    gloss.addColorStopRGBA(0, 1, 1, 1, hover ? 0.26 : 0.20);
    gloss.addColorStopRGBA(0.6, 1, 1, 1, 0.06);
    gloss.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(gloss);
    cr.rectangle(x + 1, y + 1, w - 2, h * 0.52);
    cr.fill();
}

/**
 * The impression a glyph is pressed into: a small recess with a shadow above
 * and to the left of the mark and a lit edge below and to the right, plus an
 * optional bloom when the glyph carries light of its own.
 */
export function paintGlyphInlay(cr, width, height, {bloom = null, radius = 0} = {}) {
    if (width <= 6 || height <= 6)
        return;
    const x = 1;
    const y = 1;
    const w = width - 2;
    const h = height - 2;

    const floor = new cairo.LinearGradient(0, y, 0, y + h);
    floor.addColorStopRGBA(0, 0, 0, 0, 0.26);
    floor.addColorStopRGBA(1, 0.10, 0.12, 0.16, 0.14);
    cr.setSource(floor);
    cr.rectangle(x, y, w, h);
    cr.fill();

    const shade = new cairo.LinearGradient(x, y, x, y + Math.min(h, 4));
    shade.addColorStopRGBA(0, 0, 0, 0, 0.42);
    shade.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(shade);
    cr.rectangle(x, y, w, h);
    cr.fill();

    if (bloom) {
        const centreX = width / 2;
        const centreY = height / 2;
        const glow = new cairo.RadialGradient(centreX, centreY, 0, centreX, centreY, Math.max(width, height) * 0.7);
        glow.addColorStopRGBA(0, bloom.red / 255, bloom.green / 255, bloom.blue / 255, 0.42);
        glow.addColorStopRGBA(1, bloom.red / 255, bloom.green / 255, bloom.blue / 255, 0);
        cr.setSource(glow);
        cr.rectangle(x, y, w, h);
        cr.fill();
    }

    cr.setLineWidth(1);
    cr.setSourceRGBA(0, 0, 0, 0.6);
    stroke(cr, x + 0.5, y + 0.5, x + w - 0.5, y + 0.5);
    stroke(cr, x + 0.5, y + 0.5, x + 0.5, y + h - 0.5);
    cr.setSourceRGBA(1, 1, 1, 0.20);
    stroke(cr, x + 0.5, y + h - 0.5, x + w - 0.5, y + h - 0.5);
    stroke(cr, x + w - 0.5, y + 0.5, x + w - 0.5, y + h - 0.5);
    void radius;
}

/**
 * A soft impression with no frame at all: it darkens towards its top edge and
 * fades out at the sides, so the surface reads as pressed in without any line
 * being drawn around it. Used behind the title, where a framed plate would read
 * as a box around the header.
 */
export function paintSoftImpression(cr, width, height, {depth = 0.34, fade = 0.22} = {}) {
    if (width <= 4 || height <= 4)
        return;

    const vertical = new cairo.LinearGradient(0, 0, 0, height);
    vertical.addColorStopRGBA(0, 0, 0, 0, depth);
    vertical.addColorStopRGBA(0.7, 0, 0, 0, depth * 0.45);
    vertical.addColorStopRGBA(1, 0, 0, 0, depth * 0.15);
    cr.setSource(vertical);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    // A single lit line along the bottom wall, so the impression has one edge.
    const lit = new cairo.LinearGradient(0, 0, width, 0);
    lit.addColorStopRGBA(0, 1, 1, 1, 0);
    lit.addColorStopRGBA(0.35, 1, 1, 1, 0.14);
    lit.addColorStopRGBA(0.65, 1, 1, 1, 0.14);
    lit.addColorStopRGBA(1, 1, 1, 1, 0);
    cr.setSource(lit);
    cr.rectangle(0, height - 1, width, 1);
    cr.fill();

    // Both ends are then erased rather than darkened: DEST_OUT removes what is
    // already there in proportion to the alpha it is given, which is the only
    // way to fade a painted surface out without drawing anything over it.
    const span = Math.max(6, Math.min(width * 0.5, width * fade));
    cr.setOperator(9); // DEST_OUT
    const mask = new cairo.LinearGradient(0, 0, width, 0);
    mask.addColorStopRGBA(0, 1, 1, 1, 1);
    mask.addColorStopRGBA(span / width, 1, 1, 1, 0);
    mask.addColorStopRGBA(1 - span / width, 1, 1, 1, 0);
    mask.addColorStopRGBA(1, 1, 1, 1, 1);
    cr.setSource(mask);
    cr.rectangle(0, 0, width, height);
    cr.fill();
    cr.setOperator(2); // OVER
}

export function createImpressionPlate({styleClass = 'uthy-impression', options = {}} = {}) {
    return createPaintedArea({
        styleClass,
        paint: (cr, width, height) => paintSoftImpression(cr, width, height, options),
    });
}
