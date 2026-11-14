import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {MOTION} from './glassMaterial.js';
import {createEngravedBand, createEngravedText} from './engravedText.js';
import {createIconBadge} from './iconBadge.js';
import {createMeterBar} from './meterBar.js';
import {createSlotPlate} from './metalPlate.js';

/**
 * A metric panel: a slot machined into brushed aluminium.
 *
 * The plate paints the frame, the two-pixel bevel and the cavity, so the
 * content is a separate layer inside it. Inside the slot the order is the
 * badge, the letterpressed caption, the large debossed reading and the meter,
 * with the peak line underneath.
 */
export function createSpeedGauge({title, iconName, arrow, color, motion = null, compact = false,
    icons = null}) {
    const root = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: 'uthy-speed-gauge',
        x_expand: true,
    });
    root.add_child(createSlotPlate({styleClass: 'uthy-slot-plate'}));

    const content = new St.BoxLayout({
        vertical: true,
        style_class: 'uthy-gauge-content',
        x_expand: true,
    });

    const heading = new St.BoxLayout({style_class: 'uthy-gauge-heading', x_expand: true});
    // The bundled metric icon is mounted on a glossy badge rather than laid on
    // the panel, so it reads as a part instead of a mark.
    const glyph = icons
        ? createIconBadge({
            icon: icons.createIcon({iconName, iconSize: 16, styleClass: 'uthy-gauge-icon'}),
            size: 24,
            tint: color,
        })
        : new St.Label({text: arrow, style_class: 'uthy-gauge-arrow'});
    if (!icons)
        glyph.set_style(`color: ${color};`);

    const titleLabel = createEngravedBand({text: title, role: 'caption'});
    // The readouts span the row and read from its left edge, the way a stamped
    // scale would; only the caption band hugs its text.
    const valueLabel = createEngravedText({text: '-- MB/s', role: 'value', xExpand: true});
    heading.add_child(glyph);
    heading.add_child(titleLabel.actor);
    heading.add_child(new St.Widget({x_expand: true}));
    content.add_child(heading);
    content.add_child(valueLabel.actor);

    const meter = createMeterBar({accent: color});
    content.add_child(meter.actor);

    if (!compact) {
        const peakLabel = createEngravedText({text: 'Peak —', role: 'peak', xExpand: true});
        content.add_child(peakLabel.actor);
        root._uthyPeakLabel = peakLabel;
    }
    root.add_child(content);

    root._uthyValueLabel = valueLabel;
    root._uthyFill = meter.fill;
    root._uthyTrack = meter.actor;
    root._uthyColor = color;
    root._uthyMotion = motion;
    root._uthyTitle = title;
    root._uthyLastReading = null;
    return root;
}

export function updateSpeedGauge(gauge, speed, peak, motion = gauge._uthyMotion, scale = null) {
    const reading = formatSpeed(speed);
    const changed = gauge._uthyLastReading !== null && gauge._uthyLastReading !== reading;
    gauge._uthyLastReading = reading;
    gauge._uthyValueLabel.setText(reading);
    gauge._uthyValueLabel.setAccessibleName(`${gauge._uthyTitle}: ${reading}`);
    if (gauge._uthyPeakLabel)
        gauge._uthyPeakLabel.setText(`Peak ${formatSpeed(peak)}`);

    const finiteSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    // Scale the meter to recent activity. The span used to be at least
    // 10 MB/s, so on any slower link the bar sat near the start of its travel
    // and a working monitor looked idle.
    const finiteScale = Number.isFinite(scale) ? Math.max(0, scale) : 0;
    const span = Math.max(0.1, finiteScale, finiteSpeed) * 1.15;
    // The bar fills the channel it is actually in: measuring the track keeps
    // the meter honest when the widget is resized, where a fixed width would
    // leave it stuck at the same fraction of a longer channel.
    const trackWidth = gauge._uthyTrack.get_width();
    const usable = (trackWidth > 12 ? trackWidth : 180) - 2;
    const width = Math.max(2, Math.round(usable * Math.min(1, finiteSpeed / span)));
    if (motion)
        motion.animateWidth(gauge._uthyFill, width, MOTION.meter);
    else
        gauge._uthyFill.set_width(width);

    if (changed && motion)
        motion.pulse(gauge._uthyValueLabel.actor);
}
