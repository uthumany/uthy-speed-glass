// Material system for the UthyPing widget.
//
// The vocabulary is a square liquid-glass slab over a skeuomorphic surface:
// one glowing orange accent for anything focused, active or measured, a
// monochrome body of near-blacks and off-whites, and silver rims for every
// edge that catches light. Corners are square everywhere - the radius is part
// of the material, not a setting - and depth is carried by four separate
// surfaces instead of one: the desktop casts the card's shadow, the card
// carries the tint, the backdrop paints the grid, noise and rim light, and the
// controls sit above both.
//
// Three St facts shape every value below:
//
// 1. St honours exactly one box-shadow per declaration and warns about the
//    rest, so a surface spends its single shadow on the cue that matters most
//    for it: cast shadow, specular edge, engraved groove or focus ring. Where
//    the design calls for two inset cues (a recess is dark at the top left and
//    lit at the bottom right) the second one is a border, not a shadow.
// 2. St has no backdrop sampling: there is no backdrop-filter, no filter and
//    no way for an actor to read what is painted behind it. Blur is therefore
//    implied rather than performed - a dark tint, a vertical sheen, a noise
//    layer and a bright 1px rim together read as thick glass.
// 3. Inline styles beat the stylesheet, so the card's tint and focus ring are
//    produced here while the controls stay fully CSS driven.

const WHITE = {red: 255, green: 255, blue: 255};
const BLACK = {red: 0, green: 0, blue: 0};

/** Cool near-black the slab is tinted with. */
const TINT = {red: 14, green: 18, blue: 26};

/** The one accent: a glowing orange used for focus, active and metrics. */
export const ACCENT = '#FF8A1F';
/** Lighter and darker steps of the accent, for bevels and grooves. */
export const ACCENT_LIT = '#FFC078';
export const ACCENT_DEEP = '#A94A05';

/** Silver rims, borders and the neutral half of the palette. */
export const SILVER_RIM = 'rgba(255, 255, 255, 0.12)';
export const SILVER_EDGE = 'rgba(255, 255, 255, 0.20)';
export const INK = '#F2F5F8';
export const MUTED = '#A8B3C0';

/** Grid and noise opacities, kept as constants so they stay subtle. */
export const GRID_ALPHA = 0.030;
export const NOISE_ALPHA = 0.030;
export const GRID_PITCH = 22;

/** The LED palette: one colour per connection state. */
export const LED_COLORS = {
    CONNECTED: '#2FE08A',
    INITIALIZING: '#FFC24D',
    PAUSED: '#FFC24D',
    DISCONNECTED: '#FF6B5A',
    ERROR: '#FF6B5A',
    DISABLED: '#8A93A0',
};

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
 * `alpha` is the user's surface opacity. The vertical gradient is derived from
 * it so the slab stays top-lit at every opacity setting, and the single
 * box-shadow carries the cast shadow that floats the card above the desktop.
 *
 * St gives an actor's inline style priority over the theme stylesheet, so the
 * keyboard focus ring is produced here as well: the cast shadow is swapped for
 * a square orange ring while the card holds focus.
 */
export function cardSurfaceStyle({fontSize, alpha, focused = false}) {
    const top = lighten(TINT, 0.20);
    const bottom = darken(TINT, 0.42);
    const rim = focused ? rgba(hexToRgb(ACCENT), 0.90) : SILVER_RIM;
    const shadow = focused
        ? 'box-shadow: 0 0 0 2px rgba(255, 138, 31, 0.55);'
        : 'box-shadow: 0 20px 40px rgba(0, 0, 0, 0.40);';
    return [
        `background-color: ${rgba(TINT, alpha)};`,
        'background-gradient-direction: vertical;',
        `background-gradient-start: ${rgba(top, clamp(alpha * 0.96, 0, 1))};`,
        `background-gradient-end: ${rgba(bottom, clamp(alpha * 1.04, 0, 1))};`,
        `border: 1px solid ${rim};`,
        'border-radius: 0;',
        `font-size: ${fontSize}px;`,
        shadow,
    ].join(' ');
}

/**
 * A recessed metric well: the glass has been pressed in and the light now
 * falls across its upper left wall.
 *
 * The design asks for two inset shadows, which St cannot draw, so the dark
 * press is the one shadow and the lit lower edge is a border. Together they
 * read as a cavity rather than a tile.
 */
/**
 * The floating tray the bottom controls sit on. It is the top layer of the
 * stack, so it spends its shadow on a wide cast shadow rather than on an
 * inset edge.
 */
export function floatingTrayStyle() {
    return [
        'background-gradient-direction: vertical;',
        'background-gradient-start: rgba(34, 42, 54, 0.92);',
        'background-gradient-end: rgba(12, 16, 23, 0.94);',
        'border: 1px solid rgba(255, 255, 255, 0.16);',
        'border-bottom-color: rgba(0, 0, 0, 0.55);',
        'border-radius: 0;',
        'box-shadow: 0 16px 28px rgba(0, 0, 0, 0.62);',
    ].join(' ');
}

/** The LED colour for a connection state, as an RGB object. */
export function ledColor(state) {
    return hexToRgb(LED_COLORS[state] ?? LED_COLORS.INITIALIZING);
}

/** Normalise any `#RRGGBB` (or anything else) to a usable accent. */
export function safeAccent(hex) {
    return /^#[0-9A-Fa-f]{6}$/.test(hex ?? '') ? hex.toUpperCase() : ACCENT;
}
