// Material system for the UthyPing widget.
//
// The model is adapted from the QuickLiquid liquid-glass description
// (https://quickliquid.vercel.app/): one physical definition of tint, sheen,
// rim light, refraction edge and spring motion. GNOME Shell's St toolkit has
// no DOM, WebGL or backdrop blur, so each part of that model is expressed
// with the properties St really supports.
//
// Two St constraints shape this file:
//
// 1. St honours exactly one box-shadow per declaration; extra layers are
//    dropped with a warning. Depth is therefore layered across the card, its
//    toolbar and each sub-surface instead of stacked on a single actor.
// 2. Gradients are the only blur-free way to fake a soft highlight, so the
//    sheen, the rim and the refraction edge are all gradient or border work.

const WHITE = {red: 255, green: 255, blue: 255};
const BLACK = {red: 0, green: 0, blue: 0};
const TINT = {red: 18, green: 28, blue: 46};

/** Shared motion vocabulary, in milliseconds. */
export const MOTION = {
    press: 110,
    release: 240,
    hover: 150,
    meter: 220,
    breathe: 2600,
};

export function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

/** Convert a `#RRGGBB` string to an RGB object, falling back to the tint. */
export function hexToRgb(hex) {
    if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex))
        return {...TINT};
    return {
        red: Number.parseInt(hex.slice(1, 3), 16),
        green: Number.parseInt(hex.slice(3, 5), 16),
        blue: Number.parseInt(hex.slice(5, 7), 16),
    };
}

export function rgba(color, alpha) {
    const {red, green, blue} = color;
    return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** Blend `color` towards `target`; `amount` 0 keeps the color, 1 returns target. */
export function mix(color, target, amount) {
    const ratio = clamp(amount, 0, 1);
    return {
        red: Math.round(color.red + (target.red - color.red) * ratio),
        green: Math.round(color.green + (target.green - color.green) * ratio),
        blue: Math.round(color.blue + (target.blue - color.blue) * ratio),
    };
}

export function lighten(color, amount) {
    return mix(color, WHITE, amount);
}

export function darken(color, amount) {
    return mix(color, BLACK, amount);
}

/**
 * The main glass slab.
 *
 * `alpha` is the user's surface opacity. The vertical gradient is derived
 * from it so the slab stays top-lit at every opacity setting, and the single
 * box-shadow carries the cast shadow that lifts the card off the desktop.
 *
 * St gives an actor's inline style priority over the theme stylesheet, so the
 * keyboard focus ring is produced here as well: the cast shadow is swapped for
 * the ring while the card holds focus, which also keeps the ring outside the
 * border box and therefore free of any layout shift.
 */
export function cardSurfaceStyle({radius, fontSize, alpha, focused = false}) {
    const top = lighten(TINT, 0.16);
    const bottom = darken(TINT, 0.44);
    const rim = focused ? 'rgba(126, 226, 255, 0.95)' : 'rgba(206, 228, 255, 0.34)';
    const shadow = focused
        ? 'box-shadow: 0 0 0 2px rgba(39, 201, 255, 0.60);'
        : 'box-shadow: 0 18px 42px rgba(3, 8, 18, 0.58);';
    return [
        `background-color: ${rgba(TINT, alpha)};`,
        'background-gradient-direction: vertical;',
        `background-gradient-start: ${rgba(top, clamp(alpha * 0.94, 0, 1))};`,
        `background-gradient-end: ${rgba(bottom, clamp(alpha * 1.04, 0, 1))};`,
        `border: 1px solid ${rim};`,
        `border-radius: ${radius}px;`,
        `font-size: ${fontSize}px;`,
        shadow,
    ].join(' ');
}

/**
 * The sheen on the title strip: the top edge of the glass catching the key
 * light. It carries the inner specular highlight the card itself cannot,
 * because the card already spends its single shadow on the cast shadow.
 *
 * The strip also gets a dark base under the sheen. Without it the sheen and a
 * bright wallpaper together lift the strip above the card's own tint, and the
 * brand label measured 4.16:1 against it at the minimum transparency, short
 * of the 4.5:1 this text size needs. The base holds the strip dark at every
 * transparency setting.
 */
export function toolbarSpecularStyle({radius}) {
    return [
        'background-color: rgba(8, 14, 24, 0.38);',
        'background-gradient-direction: vertical;',
        'background-gradient-start: rgba(255, 255, 255, 0.14);',
        'background-gradient-end: rgba(255, 255, 255, 0.0);',
        `border-radius: ${radius}px ${radius}px 0 0;`,
        'box-shadow: inset 0 1px 0 rgba(214, 238, 255, 0.44);',
    ].join(' ');
}

/**
 * The liquid inside a meter: a lit bead of the user's accent colour with a
 * soft bloom. The bloom uses the one available shadow slot.
 */
export function meterFillStyle({accent}) {
    const color = hexToRgb(accent);
    const lit = lighten(color, 0.42);
    const deep = darken(color, 0.28);
    return [
        'background-gradient-direction: vertical;',
        `background-gradient-start: ${rgba(lit, 0.98)};`,
        `background-gradient-end: ${rgba(deep, 0.95)};`,
        `box-shadow: 0 0 12px ${rgba(color, 0.5)};`,
    ].join(' ');
}

/** A recessed groove for the meter track, matching the current accent. */
export function meterTrackStyle() {
    return [
        'background-gradient-direction: vertical;',
        'background-gradient-start: rgba(2, 6, 16, 0.62);',
        'background-gradient-end: rgba(2, 6, 16, 0.34);',
        'border: 1px solid rgba(210, 232, 255, 0.10);',
        'box-shadow: inset 0 2px 4px rgba(2, 6, 16, 0.58);',
    ].join(' ');
}
