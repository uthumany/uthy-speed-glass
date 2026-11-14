// Engraved typography: text that is pressed into the surface rather than
// printed on it.
//
// A debossed glyph needs two light cues and St only gives one shadow per
// declaration, so each piece of text is drawn twice inside a BinLayout:
//
//   shadow copy   the dark inner shadow the near wall of the impression casts
//                 over the top of the glyph, offset up by `depth` pixels;
//   ink copy      the glyph itself, carrying one sharp lit line along its
//                 lower edge - the far wall of the impression catching light -
//                 and a metal-toned fill.
//
// Both copies carry the same text and the same font, so the pair reads as one
// piece of type. The shadow copy is marked as a decorative role so assistive
// technology sees a single label; where the toolkit has no such role the pair
// is exposed twice, which is noted in docs/ACCESSIBILITY.md.
//
// Geometry lives here (CSS cannot translate an actor); every colour, size,
// weight and tracking lives in the stylesheet, so the type scale has one source
// of truth.
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {createMetalPlate} from './metalPlate.js';

/**
 * How far the shadow copy sits above the ink copy, in pixels. Larger type is
 * pressed deeper, so the 22 px reading gets two pixels and the 9-10 px labels
 * get one.
 */
const DEPTH = {
    brand: 1,
    caption: 1,
    control: 1,
    peak: 1,
    status: 1,
    'stat-title': 1,
    'stat-value': 1,
    'mini-value': 1,
    value: 2,
};

/** The decorative role used for the shadow copy, when the toolkit has one. */
const HIDDEN_ROLE = Clutter.AccessibleRole?.NONE ?? null;

function roleClass(role) {
    return `uthy-type-${role}`;
}

/**
 * A single engraved piece of text.
 *
 * Returns a handle rather than a bare label: callers update the pair through
 * `setText`, and `actor` is what they add to a layout.
 */
export function createEngravedText({text = '', role = 'caption', xExpand = false, styleClass = null,
    ellipsize = null, accessibleName = null, reactive = false} = {}) {
    const holder = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        x_expand: xExpand,
        reactive,
        can_focus: false,
    });
    const typeClass = roleClass(role);
    const depth = DEPTH[role] ?? 1;

    if (styleClass)
        holder.add_style_class_name(styleClass);

    // The copies fill the holder only when the caller asked the holder to
    // expand; otherwise they keep their natural width, which is what lets a
    // band wrap the text instead of stretching to the row.
    const shadow = new St.Label({
        text,
        style_class: `uthy-engraved-shadow ${typeClass}`,
        x_expand: xExpand,
        reactive: false,
        translation_y: -depth,
    });
    const ink = new St.Label({
        text,
        style_class: `uthy-engraved-ink ${typeClass}`,
        x_expand: xExpand,
        reactive: false,
    });
    if (HIDDEN_ROLE !== null)
        shadow.accessible_role = HIDDEN_ROLE;

    // Pin the mode explicitly: a label that is allocated even a fraction less
    // than its natural width would otherwise cut the text short, and these
    // labels are measured to the pixel by the band around them.
    const mode = ellipsize ?? 0;
    shadow.clutter_text.ellipsize = mode;
    ink.clutter_text.ellipsize = mode;

    holder.add_child(shadow);
    holder.add_child(ink);
    if (accessibleName)
        holder.accessible_name = accessibleName;

    return {
        actor: holder,
        ink,
        shadow,
        get text() {
            return ink.text;
        },
        setText(next) {
            const value = String(next);
            if (ink.text === value)
                return false;
            shadow.text = value;
            ink.text = value;
            return true;
        },
        setAccessibleName(name) {
            holder.accessible_name = name;
        },
    };
}

/**
 * Text punched into a shallow brushed-metal band: the label is centred in a
 * plate whose recess is shadowed from the top and lit along its lower lip, so
 * captions such as DOWNLOAD or SESSION RX read as recessed rather than printed.
 * The band takes its size from the text, so it grows with the font-size
 * preference instead of clipping it.
 */
export function createEngravedBand({text = '', role = 'caption', styleClass = 'uthy-engraved-band',
    tone = 'band', accessibleName = null, plateClass = 'uthy-band-plate'} = {}) {
    const holder = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: styleClass,
        // A child of a vertical box is stretched to the full width unless it
        // asks otherwise, which would turn every caption into a full-width
        // bar; the band should hug its text wherever it is used.
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const plate = createMetalPlate({styleClass: plateClass, tone});
    const label = createEngravedText({text, role, accessibleName});
    // The padding lives on the row, not on the labels: a padded label whose
    // allocation lands a fraction under its natural width would ellipsize, and
    // the band is sized from exactly that width.
    const content = new St.BoxLayout({style_class: 'uthy-band-content'});
    content.add_child(label.actor);
    holder.add_child(plate);
    holder.add_child(content);
    return {
        actor: holder,
        label,
        plate,
        get text() {
            return label.text;
        },
        setText: next => label.setText(next),
        setAccessibleName: name => label.setAccessibleName(name),
    };
}

export const ENGRAVED_DEPTH = DEPTH;
